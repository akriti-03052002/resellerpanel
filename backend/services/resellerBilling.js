const Partner = require("../models/Partner");
const ResellerInventory = require("../models/ResellerInventory");
const ResellerBillingConfig = require("../models/ResellerBillingConfig");
const ResellerInvoice = require("../models/ResellerInvoice");
const ScreenLicensePurchaseOrder = require("../models/ScreenLicensePurchaseOrder");
const { getOrCreatePricingPlan } = require("./resellerPricing");
const logActivity = require("../utils/logActivity");

/* ============================================================
   RESELLER BILLING
   Generates a ResellerInvoice billed strictly on
   totalPurchasedLicenses — never active/allocated/registered
   counts (RESELLER_COMPLETE_PLAN.md correction #1). Manual for
   this release: triggered by an admin action
   (adminResellerController.runBillingNow), not a scheduler — see
   B12 item 1. Idempotent via ResellerInvoice's unique
   (partnerId, billingPeriodStart, billingPeriodEnd) index, so the
   same service can be wired to a cron job later with zero change
   to this logic.
============================================================ */

const CYCLE_MULTIPLIER = { monthly: 1, quarterly: 3, yearly: 12 };
const CYCLE_DAYS = { monthly: 30, quarterly: 90, yearly: 365 };

let invoiceCounter = 0;
const generateInvoiceNumber = async () => {
  const count = await ResellerInvoice.countDocuments();
  invoiceCounter = Math.max(invoiceCounter, count) + 1;
  return `INV-RP-${String(invoiceCounter).padStart(5, "0")}`;
};

// billingPeriodEnd is anchored to the start of the current day (not raw
// `now`) specifically so two admin clicks of "Run Billing Now" on the
// same day compute the IDENTICAL period and collide on
// ResellerInvoice's unique (partnerId, billingPeriodStart,
// billingPeriodEnd) index — a millisecond-precise `now` would never
// collide with itself on a second run, silently duplicating invoices.
const resolveBillingPeriod = (config, now = new Date()) => {
  const days = CYCLE_DAYS[config.billingCycle];
  const billingPeriodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const billingPeriodStart = new Date(billingPeriodEnd.getTime() - days * 24 * 60 * 60 * 1000);
  return { billingPeriodStart, billingPeriodEnd };
};

/* ------------------------------------------------------------
   B14a — Mid-Cycle Purchase Billing (pure calculation).

   Prices EVERY purchase order at the rate it locked in when it was
   bought (order.pricing.unitPrice, snapshotted at order-creation
   time — see ScreenLicensePurchaseOrder.js) — never today's current
   plan rate. If SPOTX changes a partner's price, that new rate only
   applies to licenses bought FROM THEN ON; every earlier batch keeps
   billing at whatever it was purchased at, cycle after cycle,
   forever. This is why baseOrders/inCycleOrders below carry their
   own unitPrice each, instead of one rate being applied to a total
   quantity.

   No day-based discount either: a license purchased on the 15th of
   the month is billed for the FULL cycle at its own locked rate,
   exactly like one purchased on the 1st — the split between
   `baseLineItems` (bought before this cycle) and `proratedLineItems`
   (bought during this cycle) exists purely so the invoice/estimate
   can show the partner which batch was bought when, not because the
   rate or formula differs between them.

   `currentUnitPriceForAdjustments` only prices the one bucket that
   has no purchase order behind it at all — quantity SPOTX added via
   a manual inventory adjustment (adminResellerController.adjustInventory)
   rather than a purchase. Since that has no locked-in rate of its
   own, it's billed at today's plan rate and folded into
   baseLineItems as a labeled line.

   `prorationRule: "none"` (including unset/undefined, defensively
   defaulted below) excludes in-cycle purchases from this invoice
   entirely — they are simply absent from purchasedLicenseSnapshot
   until their createdAt falls before a later billingPeriodStart, at
   which point they become part of that cycle's baseLineItems
   automatically, with no extra bookkeeping required.
------------------------------------------------------------- */
const calculateProration = ({
  totalPurchasedLicenses,
  baseOrders,
  inCycleOrders,
  currentUnitPriceForAdjustments,
  cycleMultiplier,
  prorationRule
}) => {
  const rule = prorationRule === "daily_proration" ? "daily_proration" : "none";

  const toLineItem = (order) => ({
    orderCode: order.orderCode || String(order._id),
    quantity: order.quantity,
    purchaseDate: order.createdAt,
    unitPrice: order.pricing?.unitPrice,
    cycleMultiplier,
    amount: order.quantity * order.pricing.unitPrice * cycleMultiplier
  });

  const baseLineItems = baseOrders.map(toLineItem);
  const includeInCycle = rule === "daily_proration" && inCycleOrders.length > 0;
  const proratedLineItems = includeInCycle ? inCycleOrders.map(toLineItem) : [];

  // Licenses SPOTX added by manual adjustment rather than a purchase
  // order have no locked-in rate of their own — bill the shortfall at
  // today's plan rate, folded into the base bucket as its own line.
  const allOrdersQty = baseOrders.reduce((sum, o) => sum + o.quantity, 0)
    + inCycleOrders.reduce((sum, o) => sum + o.quantity, 0);
  const adjustmentQty = Math.max(0, totalPurchasedLicenses - allOrdersQty);
  if (adjustmentQty > 0) {
    baseLineItems.push({
      orderCode: "Manual adjustment",
      quantity: adjustmentQty,
      purchaseDate: null,
      unitPrice: currentUnitPriceForAdjustments,
      cycleMultiplier,
      amount: adjustmentQty * currentUnitPriceForAdjustments * cycleMultiplier
    });
  }

  const baseLicenses = baseLineItems.reduce((sum, i) => sum + i.quantity, 0);
  const baseAmount = baseLineItems.reduce((sum, i) => sum + i.amount, 0);
  const proratedLicenseCount = includeInCycle ? inCycleOrders.reduce((sum, o) => sum + o.quantity, 0) : 0;
  const proratedAmount = proratedLineItems.reduce((sum, i) => sum + i.amount, 0);

  return { baseLicenses, baseAmount, baseLineItems, proratedLicenseCount, proratedAmount, proratedLineItems };
};

/* Generates (or returns the existing) invoice for one partner's current
   billing period. Never mutates purchased-license counts — billing only
   reads inventory, it does not change it. */
const generateInvoiceForPartner = async (partnerId, { now = new Date(), performedByUserId } = {}) => {
  const [inventory, config, plan] = await Promise.all([
    ResellerInventory.findOne({ partnerId }),
    ResellerBillingConfig.findOne({ partnerId }),
    getOrCreatePricingPlan(partnerId)
  ]);

  if (!inventory) {
    throw new Error("This partner has no purchased licenses yet — nothing to bill.");
  }

  const billingConfig = config || (await ResellerBillingConfig.create({ partnerId }));
  const { billingPeriodStart, billingPeriodEnd } = resolveBillingPeriod(billingConfig, now);

  const existing = await ResellerInvoice.findOne({ partnerId, billingPeriodStart, billingPeriodEnd });
  if (existing) return existing;

  const cycleMultiplier = CYCLE_MULTIPLIER[billingConfig.billingCycle];
  const unitPriceSnapshot = plan.effectivePricePerScreen;

  // Every paid order ever, split into "before this cycle" and "landed
  // inside this cycle" — each priced at its OWN locked-in rate
  // (order.pricing.unitPrice), never today's current plan rate (B14a).
  // Only "paid" orders count, matching how totalPurchasedLicenses itself
  // is only ever incremented off paid orders (see resellerInventory.js).
  const [baseOrders, inCycleOrders] = await Promise.all([
    ScreenLicensePurchaseOrder.find({ partnerId, status: "paid", createdAt: { $lt: billingPeriodStart } })
      .select("quantity createdAt orderCode pricing.unitPrice")
      .lean(),
    ScreenLicensePurchaseOrder.find({ partnerId, status: "paid", createdAt: { $gte: billingPeriodStart, $lt: billingPeriodEnd } })
      .select("quantity createdAt orderCode pricing.unitPrice")
      .lean()
  ]);

  const { baseLicenses, baseAmount, proratedLicenseCount, proratedAmount } = calculateProration({
    totalPurchasedLicenses: inventory.totalPurchasedLicenses,
    baseOrders,
    inCycleOrders,
    currentUnitPriceForAdjustments: unitPriceSnapshot,
    cycleMultiplier,
    prorationRule: billingConfig.prorationRule
  });

  const purchasedLicenseSnapshot = baseLicenses;

  const subtotal = baseAmount + proratedAmount;
  const taxAmount = (subtotal * plan.taxRatePercent) / 100;
  const total = subtotal + taxAmount;

  const dueDate = new Date(billingPeriodEnd.getTime() + billingConfig.dueDays * 24 * 60 * 60 * 1000);

  const invoiceNumber = await generateInvoiceNumber();

  const invoice = await ResellerInvoice.create({
    partnerId,
    invoiceNumber,
    billingCycle: billingConfig.billingCycle,
    billingPeriodStart,
    billingPeriodEnd,
    purchasedLicenseSnapshot,
    proratedLicenseCount,
    proratedAmount,
    standardUnitPriceSnapshot: plan.standardPricePerScreen,
    pricingModeSnapshot: plan.pricingMode,
    wholesaleDiscountPercentSnapshot: plan.pricingMode === "discount_percent" ? plan.wholesaleDiscountPercent : undefined,
    fixedUnitPriceSnapshot: plan.pricingMode === "fixed_price" ? plan.fixedPricePerScreen : undefined,
    unitPriceSnapshot,
    cycleMultiplier,
    subtotal,
    taxRatePercent: plan.taxRatePercent,
    taxAmount,
    total,
    dueDate,
    paymentStatus: "pending"
  });

  await logActivity({
    partnerId,
    performedByType: performedByUserId ? "spotx_user" : "system",
    performedByUserId,
    activityType: "reseller_invoice_generated",
    entityType: "ResellerInvoice",
    entityId: invoice._id,
    description:
      proratedLicenseCount > 0
        ? `Invoice ${invoiceNumber} generated for ${purchasedLicenseSnapshot} purchased licenses, plus ${proratedLicenseCount} licenses added mid-cycle billed at the full rate for ₹${proratedAmount.toFixed(2)} (${billingConfig.billingCycle}).`
        : `Invoice ${invoiceNumber} generated for ${purchasedLicenseSnapshot} purchased licenses (${billingConfig.billingCycle}).`
  });

  return invoice;
};

/* Read-only preview of what the CURRENT billing period would invoice for
   right now, for the partner's own Billing page — so they can see what
   they owe before the cycle actually closes and a ResellerInvoice gets
   generated. Same math as generateInvoiceForPartner, just never writes
   anything. Returns null if the partner has no purchased licenses yet. */
const estimateCurrentDue = async (partnerId, { now = new Date() } = {}) => {
  const [inventory, config, plan] = await Promise.all([
    ResellerInventory.findOne({ partnerId }),
    ResellerBillingConfig.findOne({ partnerId }),
    getOrCreatePricingPlan(partnerId)
  ]);

  if (!inventory || inventory.totalPurchasedLicenses <= 0) return null;

  const billingConfig = config || { billingCycle: "monthly", dueDays: 7, prorationRule: "daily_proration" };
  const { billingPeriodStart, billingPeriodEnd } = resolveBillingPeriod(billingConfig, now);

  const cycleMultiplier = CYCLE_MULTIPLIER[billingConfig.billingCycle];
  const unitPriceSnapshot = plan.effectivePricePerScreen;

  const [baseOrders, inCycleOrders] = await Promise.all([
    ScreenLicensePurchaseOrder.find({ partnerId, status: "paid", createdAt: { $lt: billingPeriodStart } })
      .select("quantity createdAt orderCode pricing.unitPrice")
      .sort({ createdAt: -1 })
      .lean(),
    ScreenLicensePurchaseOrder.find({ partnerId, status: "paid", createdAt: { $gte: billingPeriodStart, $lt: billingPeriodEnd } })
      .select("quantity createdAt orderCode pricing.unitPrice")
      .lean()
  ]);

  const { baseLicenses, baseAmount, baseLineItems, proratedLicenseCount, proratedAmount, proratedLineItems } = calculateProration({
    totalPurchasedLicenses: inventory.totalPurchasedLicenses,
    baseOrders,
    inCycleOrders,
    currentUnitPriceForAdjustments: unitPriceSnapshot,
    cycleMultiplier,
    prorationRule: billingConfig.prorationRule
  });

  const purchasedLicenseSnapshot = baseLicenses;
  const subtotal = baseAmount + proratedAmount;
  const taxAmount = (subtotal * plan.taxRatePercent) / 100;
  const total = subtotal + taxAmount;
  const dueDate = new Date(billingPeriodEnd.getTime() + billingConfig.dueDays * 24 * 60 * 60 * 1000);

  return {
    billingCycle: billingConfig.billingCycle,
    billingPeriodStart,
    billingPeriodEnd,
    purchasedLicenseSnapshot,
    baseAmount,
    baseLineItems,
    proratedLicenseCount,
    proratedAmount,
    proratedLineItems,
    unitPriceSnapshot,
    cycleMultiplier,
    standardUnitPriceSnapshot: plan.standardPricePerScreen,
    pricingModeSnapshot: plan.pricingMode,
    wholesaleDiscountPercentSnapshot: plan.pricingMode === "discount_percent" ? plan.wholesaleDiscountPercent : undefined,
    fixedUnitPriceSnapshot: plan.pricingMode === "fixed_price" ? plan.fixedPricePerScreen : undefined,
    subtotal,
    taxRatePercent: plan.taxRatePercent,
    taxAmount,
    total,
    dueDate
  };
};

/* Reconstructs the same per-order line-item detail (base + prorated) for
   an ALREADY GENERATED invoice, for the partner's "view full breakdown"
   modal. Never stored on the invoice itself — the underlying paid
   purchase orders are still queryable by the invoice's own
   billingPeriodStart/End, so this just re-derives the same view
   estimateCurrentDue produces, using the invoice's own frozen snapshot
   values (unitPriceSnapshot, cycleMultiplier) rather than today's rate. */
const getInvoiceLineItems = async (invoice) => {
  const [baseOrders, inCycleOrders] = await Promise.all([
    ScreenLicensePurchaseOrder.find({ partnerId: invoice.partnerId, status: "paid", createdAt: { $lt: invoice.billingPeriodStart } })
      .select("quantity createdAt orderCode pricing.unitPrice")
      .sort({ createdAt: -1 })
      .lean(),
    ScreenLicensePurchaseOrder.find({ partnerId: invoice.partnerId, status: "paid", createdAt: { $gte: invoice.billingPeriodStart, $lt: invoice.billingPeriodEnd } })
      .select("quantity createdAt orderCode pricing.unitPrice")
      .lean()
  ]);

  const { baseAmount, baseLineItems, proratedLineItems } = calculateProration({
    totalPurchasedLicenses: invoice.purchasedLicenseSnapshot + invoice.proratedLicenseCount,
    baseOrders,
    inCycleOrders,
    currentUnitPriceForAdjustments: invoice.unitPriceSnapshot,
    cycleMultiplier: invoice.cycleMultiplier,
    prorationRule: invoice.proratedLicenseCount > 0 ? "daily_proration" : "none"
  });

  return { baseAmount, baseLineItems, proratedLineItems };
};

/* Admin-triggered "Run Reseller Billing Now" — generates invoices for
   every reseller partner whose config exists (or defaults to one on
   first run). Idempotent per partner via the unique period index. */
const runBillingForAllPartners = async ({ performedByUserId, now = new Date() } = {}) => {
  const partners = await Partner.find({ partnerType: "reseller", status: "active" }).select("_id");

  const results = [];
  for (const partner of partners) {
    try {
      const invoice = await generateInvoiceForPartner(partner._id, { now, performedByUserId });
      results.push({ partnerId: partner._id, invoiceId: invoice._id, invoiceNumber: invoice.invoiceNumber });
    } catch (error) {
      results.push({ partnerId: partner._id, error: error.message });
    }
  }

  return results;
};

// Flips pending/failed invoices past their dueDate to "overdue" — read by
// enforcement logic (see partnerVerification-style status gating, B12
// item 7: panel-access restriction only) to decide whether a partner's
// new allocate/register/activate/purchase actions should be blocked.
// Manual trigger for now, same as everything else in this file.
const markOverdueInvoices = async () => {
  const result = await ResellerInvoice.updateMany(
    { paymentStatus: { $in: ["pending", "failed"] }, dueDate: { $lt: new Date() } },
    { $set: { paymentStatus: "overdue" } }
  );
  return result.modifiedCount || 0;
};

module.exports = {
  generateInvoiceForPartner,
  estimateCurrentDue,
  getInvoiceLineItems,
  runBillingForAllPartners,
  markOverdueInvoices,
  calculateProration,
  CYCLE_MULTIPLIER
};
