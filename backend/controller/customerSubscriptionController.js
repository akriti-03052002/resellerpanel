const { Screen, ScreenPricing, Partner } = require("../models/Index");
const { generateCommissionForCustomerPayment } = require("../services/commissionEngine");
const { autoAssignVendorTier } = require("../services/tierAssignment");

/* ============================================================
   CUSTOMER — SUBSCRIPTION (SELF-SERVICE)
   No payment gateway in this project — subscribeToPlan activates
   the subscription immediately (self-checkout), the same way
   adminCustomerController.markCustomerPaid does, including
   generating the vendor's commission. Deliberately not gated by
   trial status, so a customer can do this before their trial ends.

   Billing cycle / proration: a subscription runs on a rolling
   30-day currentPeriodStart -> currentPeriodEnd window.
   - Upgrade (or same-cost lateral change) mid-cycle: applies right
     away, charging only the prorated difference for the days left
     in the window — the window itself does NOT reset.
   - Downgrade mid-cycle: does NOT apply right away. They already
     paid for the pricier plan this cycle, so they keep it (and
     aren't charged anything more) until currentPeriodEnd, at which
     point the downgrade takes effect — see scheduledChange below.
   - A change requested once the window has lapsed is charged in
     full and opens a fresh window.

   There's no scheduler to auto-renew or auto-apply a scheduled
   downgrade at currentPeriodEnd; materializeScheduledChangeIfDue
   applies it lazily the next time the customer's subscription is
   touched (viewed or changed) on or after that date — same "lazy,
   no cron" spirit as everything else in this billing flow.
============================================================ */

const PLAN_PRICE_FIELD = { basic: "basicPricePerScreen", premium: "premiumPricePerScreen" };
const CYCLE_DAYS = 30;

const getPricing = async () => {
  let pricing = await ScreenPricing.findOne();
  if (!pricing) pricing = await ScreenPricing.create({});
  return pricing;
};

const materializeScheduledChangeIfDue = async (customer) => {
  const { subscription } = customer;

  if (!subscription.scheduledChange?.plan || !subscription.currentPeriodEnd) return;
  if (new Date() < new Date(subscription.currentPeriodEnd)) return;

  subscription.plan = subscription.scheduledChange.plan;
  subscription.screenCount = subscription.scheduledChange.screenCount;
  subscription.scheduledChange = undefined;
  await customer.save();
};

// Pure so the frontend can mirror it for a live preview before submitting —
// the server recomputes with its own clock and DB state as the
// authoritative source when actually charging.
const computeChange = (subscription, pricing, plan, screenCount, now = new Date()) => {
  const newPricePerScreen = pricing[PLAN_PRICE_FIELD[plan]] || 0;
  const fullAmount = screenCount * newPricePerScreen;

  const hasOpenCycle = subscription.status === "active"
    && subscription.currentPeriodEnd
    && now < new Date(subscription.currentPeriodEnd);

  if (!hasOpenCycle) {
    return {
      type: "immediate",
      amount: fullAmount,
      prorated: false,
      fullAmount,
      periodStart: now,
      periodEnd: new Date(now.getTime() + CYCLE_DAYS * 24 * 60 * 60 * 1000)
    };
  }

  const currentPricePerScreen = pricing[PLAN_PRICE_FIELD[subscription.plan]] || 0;
  const currentTotal = currentPricePerScreen * (subscription.screenCount || 0);
  const periodEnd = new Date(subscription.currentPeriodEnd);

  if (fullAmount < currentTotal) {
    // Downgrade — deferred to periodEnd, nothing charged now, current
    // plan/screenCount/period are left completely untouched.
    return { type: "deferred", amount: 0, prorated: false, fullAmount, periodEnd };
  }

  // Upgrade or same-cost lateral change — apply now, prorate the diff.
  const periodStart = new Date(subscription.currentPeriodStart);
  const totalMs = periodEnd - periodStart;
  const remainingMs = periodEnd - now;
  const remainingFraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;

  const proratedDiff = Math.round((fullAmount - currentTotal) * remainingFraction * 100) / 100;

  return { type: "immediate", amount: Math.max(0, proratedDiff), prorated: true, fullAmount, periodStart, periodEnd };
};

const getSubscription = async (req, res) => {
  await materializeScheduledChangeIfDue(req.customer);

  const [registeredScreenCount, pricing] = await Promise.all([
    Screen.countDocuments({ customerId: req.customer._id }),
    getPricing()
  ]);

  return res.json({
    success: true,
    data: {
      subscription: req.customer.subscription,
      trial: req.customer.trial,
      trialExpired: req.customer.trialExpired,
      registeredScreenCount,
      plans: {
        basic: pricing.basicPricePerScreen,
        premium: pricing.premiumPricePerScreen
      }
    }
  });
};

const subscribeToPlan = async (req, res) => {
  try {
    const screenCount = Number(req.body.screenCount);
    const { plan } = req.body;

    if (!Number.isInteger(screenCount) || screenCount < 1) {
      return res.status(400).json({ success: false, message: "Enter a valid number of screens (at least 1)." });
    }

    if (!PLAN_PRICE_FIELD[plan]) {
      return res.status(400).json({ success: false, message: "Choose a valid plan (basic or premium)." });
    }

    const pricing = await getPricing();
    const customer = req.customer;
    await materializeScheduledChangeIfDue(customer);

    const change = computeChange(customer.subscription, pricing, plan, screenCount);

    let message;

    if (change.type === "deferred") {
      customer.subscription.scheduledChange = { plan, screenCount };
      await customer.save();

      message = `You'll switch to the ${plan} plan (${screenCount} screens) on ${change.periodEnd.toLocaleDateString("en-IN")} — you keep your current plan until then, and there's no charge today.`;
    } else {
      customer.subscription.status = "active";
      customer.subscription.screenCount = screenCount;
      customer.subscription.plan = plan;
      customer.subscription.currentPeriodStart = change.periodStart;
      customer.subscription.currentPeriodEnd = change.periodEnd;
      customer.subscription.scheduledChange = undefined;
      await customer.save();

      if (change.amount > 0) {
        const partner = await Partner.findById(customer.partnerId);

        if (partner) {
          await generateCommissionForCustomerPayment({ customer, revenue: change.amount, screenCount, req });
          await autoAssignVendorTier(partner);
        }
      }

      message = change.prorated
        ? `Prorated charge of ₹${change.amount.toLocaleString("en-IN")} for the rest of this billing cycle. From ${change.periodEnd.toLocaleDateString("en-IN")} you'll be billed ₹${change.fullAmount.toLocaleString("en-IN")}/month in full.`
        : `Subscribed to the ${plan} plan for ${screenCount} screens.`;
    }

    return res.json({
      success: true,
      message,
      data: {
        subscription: customer.subscription,
        amount: change.amount,
        prorated: change.prorated,
        deferred: change.type === "deferred",
        fullAmount: change.fullAmount
      }
    });
  } catch (error) {
    console.error("subscribeToPlan error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong activating your subscription." });
  }
};

module.exports = { getSubscription, subscribeToPlan };
