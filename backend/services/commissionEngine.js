const { CommissionRule, PartnerCommission, Partner, PartnerNotification } = require("../models/Index");
const logActivity = require("../utils/logActivity");

/* ============================================================
   COMMISSION ENGINE
   Runs when an admin marks a PartnerOpportunity "won". Picks the
   active CommissionRule for the partner's current tier (falls
   back to a tier-less/generic rule if the partner has no tier),
   computes the commission, writes the ledger row, and bumps the
   partner's cached stats.

   Two payment shapes need special handling here:
   - Reseller ("wholesale_discount"): not a payout — the discount IS
     their margin, already realized at purchase time. Still logged as
     a PartnerCommission row for reporting, but settled immediately
     rather than entering the pending -> approved -> paid flow.
   - Affiliate/Influencer optional recurring add-on: a SECOND rule
     (CommissionRule.isAddOn = true, scoped by partnerType, not tied to
     any tier) that the admin chooses to apply per-deal, not something
     that fires automatically.

   KNOWN LIMITATION: for commissionType starting with "recurring_",
   this only creates the FIRST cycle. There's no scheduler yet to
   auto-generate renewal cycles (cycleNumber 2, 3, ...) — that
   would need a cron job, which is out of scope for this pass.
============================================================ */

const computeGrossCommission = (rule, revenue, screenCount) => {
  switch (rule.commissionType) {
    case "percentage":
    case "recurring_percentage":
    case "wholesale_discount":
      return (revenue * (rule.rate || 0)) / 100;

    case "fixed_per_deal":
    case "recurring_fixed":
      return rule.fixedAmount || 0;

    case "fixed_per_screen":
      return (rule.perScreenAmount || 0) * (screenCount || 0);

    case "hybrid": {
      const percentPart = (revenue * (rule.hybrid?.percentageRate || 0)) / 100;
      const fixedPart = rule.hybrid?.fixedAmount || 0;
      const screenPart = (rule.hybrid?.perScreenAmount || 0) * (screenCount || 0);
      return percentPart + fixedPart + screenPart;
    }

    default:
      return 0;
  }
};

const computeExpiryFromRecurring = (rule) => {
  if (!rule.recurring?.enabled || !rule.recurring.duration) return undefined;

  const expiry = new Date();
  if (rule.recurring.durationType === "months") expiry.setMonth(expiry.getMonth() + rule.recurring.duration);
  else if (rule.recurring.durationType === "years") expiry.setFullYear(expiry.getFullYear() + rule.recurring.duration);
  else return undefined;

  return expiry;
};

const findRuleForPartner = async (partner) => {
  const tierId = partner.program?.tierId;

  if (tierId) {
    const tierRule = await CommissionRule.findOne({ tierId, status: "active" });
    if (tierRule) return tierRule;
  }

  return CommissionRule.findOne({
    status: "active",
    isAddOn: { $ne: true },
    $or: [{ tierId: null }, { tierId: { $exists: false } }]
  });
};

const createCommissionRow = async ({ partner, opportunityId, customerId, rule, revenue, screenCount, cycleNumber, parentCommissionId }) => {
  const grossCommission = computeGrossCommission(rule, revenue, screenCount);
  const isWholesale = rule.commissionType === "wholesale_discount";
  const isRecurring = rule.recurring?.enabled && rule.commissionType.startsWith("recurring_");

  const commission = await PartnerCommission.create({
    partnerId: partner._id,
    opportunityId: opportunityId || undefined,
    customerId: customerId || undefined,
    commissionRuleId: rule._id,
    transaction: { revenue, screenCount, currency: "INR" },
    calculation: {
      commissionType: rule.commissionType,
      rate: rule.rate || 0,
      fixedAmount: rule.fixedAmount || 0,
      grossCommission,
      deductions: 0,
      netCommission: grossCommission
    },
    recurring: {
      isRecurring,
      cycleNumber: cycleNumber || 1,
      parentCommissionId: parentCommissionId || undefined,
      expiresAt: computeExpiryFromRecurring(rule)
    },
    settlement: {
      eligibleAt: new Date(),
      // Wholesale margin is already realized — nothing further to pay out.
      status: isWholesale ? "settled" : "pending"
    }
  });

  if (isWholesale) {
    partner.stats.totalCommission += grossCommission;
    partner.stats.paidCommission += grossCommission;
  } else {
    partner.stats.totalCommission += grossCommission;
    partner.stats.pendingCommission += grossCommission;
  }

  return { commission, isWholesale };
};

const generateCommissionForWonOpportunity = async ({ opportunity, revenue, screenCount, applyAddOn, req, adminUser }) => {
  const partner = await Partner.findById(opportunity.partnerId);

  if (!partner) {
    throw new Error("Partner not found for this opportunity.");
  }

  const rule = await findRuleForPartner(partner);

  if (!rule) {
    throw new Error(
      "No active commission rule matches this partner's tier, and no generic fallback rule exists. Create one before marking deals won."
    );
  }

  partner.stats.wonDeals += 1;
  partner.stats.totalRevenue += revenue;

  const { commission, isWholesale } = await createCommissionRow({
    partner,
    opportunityId: opportunity._id,
    customerId: opportunity.customerId,
    rule,
    revenue,
    screenCount
  });

  let addOnCommission = null;

  if (applyAddOn) {
    const addOnRule = await CommissionRule.findOne({
      partnerType: partner.partnerType,
      isAddOn: true,
      status: "active"
    });

    if (addOnRule) {
      const result = await createCommissionRow({
        partner,
        opportunityId: opportunity._id,
        customerId: opportunity.customerId,
        rule: addOnRule,
        revenue,
        screenCount,
        parentCommissionId: commission._id
      });
      addOnCommission = result.commission;
    }
  }

  await partner.save();

  await logActivity({
    partnerId: partner._id,
    performedByType: "spotx_user",
    performedByUserId: adminUser._id,
    activityType: "commission_created",
    entityType: "PartnerCommission",
    entityId: commission._id,
    description: isWholesale
      ? `Wholesale margin of ${commission.calculation.netCommission.toFixed(2)} recorded for a won deal.`
      : `Commission of ${commission.calculation.netCommission.toFixed(2)} generated for a won deal.`,
    req
  });

  await PartnerNotification.create({
    partnerId: partner._id,
    type: "commission_created",
    title: isWholesale ? "Wholesale margin recorded" : "Commission earned",
    message: isWholesale
      ? `Your wholesale margin of ${commission.calculation.netCommission.toFixed(2)} was recorded on a won deal.`
      : `You earned ${commission.calculation.netCommission.toFixed(2)} commission on a won deal.`,
    entity: { type: "PartnerCommission", entityId: commission._id }
  });

  if (addOnCommission) {
    await PartnerNotification.create({
      partnerId: partner._id,
      type: "commission_created",
      title: "Recurring add-on applied",
      message: `An extra ${addOnCommission.calculation.netCommission.toFixed(2)} recurring add-on was applied to this deal.`,
      entity: { type: "PartnerCommission", entityId: addOnCommission._id }
    });
  }

  return { commission, addOnCommission };
};

/* ============================================================
   Vendor-only path: fires whenever a Customer's subscription is
   paid — either an admin marking it via adminCustomerController.
   markCustomerPaid, or the customer's own self-checkout (see
   customerSubscriptionController.subscribeToPlan; adminUser is
   undefined there since no admin is involved). This is the "core
   growth engine" Vendor model in practice — lifetime-recurring %
   of subscription per active screen — but since there's no
   scheduler, each payment cycle is a manual/self-service action
   rather than an automatic renewal. cycleNumber counts prior
   commissions against this customer so recurring rules read
   correctly in reporting even without a cron.
============================================================ */
const generateCommissionForCustomerPayment = async ({ customer, revenue, screenCount, req, adminUser }) => {
  const partner = await Partner.findById(customer.partnerId);

  if (!partner) {
    throw new Error("Partner not found for this customer.");
  }

  const rule = await findRuleForPartner(partner);

  if (!rule) {
    throw new Error(
      "No active commission rule matches this partner's tier, and no generic fallback rule exists. Create one before marking payment received."
    );
  }

  const priorCycles = await PartnerCommission.countDocuments({ customerId: customer._id });

  partner.stats.totalRevenue += revenue;

  const { commission, isWholesale } = await createCommissionRow({
    partner,
    customerId: customer._id,
    rule,
    revenue,
    screenCount,
    cycleNumber: priorCycles + 1
  });

  await partner.save();

  await logActivity({
    partnerId: partner._id,
    performedByType: adminUser ? "spotx_user" : "system",
    performedByUserId: adminUser?._id,
    activityType: "commission_created",
    entityType: "PartnerCommission",
    entityId: commission._id,
    description: isWholesale
      ? `Wholesale margin of ${commission.calculation.netCommission.toFixed(2)} recorded for ${customer.companyName}'s payment.`
      : `Commission of ${commission.calculation.netCommission.toFixed(2)} generated for ${customer.companyName}'s payment.`,
    req
  });

  await PartnerNotification.create({
    partnerId: partner._id,
    type: "commission_created",
    title: isWholesale ? "Wholesale margin recorded" : "Commission earned",
    message: isWholesale
      ? `Your wholesale margin of ${commission.calculation.netCommission.toFixed(2)} was recorded for ${customer.companyName}.`
      : `You earned ${commission.calculation.netCommission.toFixed(2)} commission for ${customer.companyName}'s payment.`,
    entity: { type: "PartnerCommission", entityId: commission._id }
  });

  return { commission };
};

module.exports = { generateCommissionForWonOpportunity, generateCommissionForCustomerPayment };
