const asyncHandler = require("express-async-handler");
const ScreenLicensePurchaseOrder = require("../models/ScreenLicensePurchaseOrder");
const { computeOrderPricing } = require("../services/resellerPricing");
const requirePrepaymentDone = require("../utils/requirePrepaymentDone");
const logActivity = require("../utils/logActivity");

/* ============================================================
   PARTNER — SCREEN LICENSE PURCHASE ORDERS (RESELLER)
   Quantity is the only thing ever trusted from the client — every
   price figure is computed server-side from ResellerPricingPlan
   (RESELLER_COMPLETE_PLAN.md B10). The reseller only requests a
   quantity here — no payment happens per order at all. Requesting
   requires the one-time prepayment to already be done
   (requirePrepaymentDone); once that's cleared, an admin accepting
   a request just credits the licenses immediately and their cost
   rolls into the partner's regular billing-cycle invoice (see
   adminLicenseOrderController.acceptLicenseOrder and
   services/resellerBilling.js) — there's no separate per-order
   online/offline payment step to complete here.
============================================================ */

let orderCounter = 0;
const nextOrderCode = async () => {
  const count = await ScreenLicensePurchaseOrder.countDocuments();
  orderCounter = Math.max(orderCounter, count) + 1;
  return `RP-LIC-${String(orderCounter).padStart(5, "0")}`;
};

const createLicenseOrder = asyncHandler(async (req, res) => {
  const quantity = parseInt(req.body.quantity, 10);

  if (!quantity || quantity < 1) {
    return res.status(400).json({ success: false, message: "Enter a valid quantity." });
  }

  const prepaymentGate = await requirePrepaymentDone(req.partner._id);
  if (prepaymentGate) {
    return res.status(prepaymentGate.status).json({ success: false, message: prepaymentGate.message });
  }

  const { plan, pricing } = await computeOrderPricing({ partnerId: req.partner._id, quantity });

  if (plan.minPurchaseQty && quantity < plan.minPurchaseQty) {
    return res.status(400).json({
      success: false,
      message: `Minimum purchase quantity is ${plan.minPurchaseQty} licenses.`
    });
  }

  const orderCode = await nextOrderCode();

  const purchaseOrder = await ScreenLicensePurchaseOrder.create({
    partnerId: req.partner._id,
    quantity,
    pricing,
    pricingPlanId: plan._id,
    status: "created",
    orderStatus: "requested",
    orderCode
  });

  await logActivity({
    partnerId: req.partner._id,
    performedByType: "partner_user",
    performedByUserId: req.partnerUser?._id,
    activityType: "note",
    entityType: "ScreenLicensePurchaseOrder",
    entityId: purchaseOrder._id,
    description: `Requested ${quantity} screen licenses (order ${orderCode}) — awaiting SPOTX approval.`
  });

  return res.status(201).json({
    success: true,
    message: "Request submitted — SPOTX will review it shortly.",
    data: { purchaseOrder }
  });
});

const listLicenseOrders = asyncHandler(async (req, res) => {
  const orders = await ScreenLicensePurchaseOrder.find({ partnerId: req.partner._id }).sort({ createdAt: -1 });
  return res.json({ success: true, data: orders });
});

const getLicenseOrder = asyncHandler(async (req, res) => {
  const order = await ScreenLicensePurchaseOrder.findOne({ _id: req.params.id, partnerId: req.partner._id });
  if (!order) {
    return res.status(404).json({ success: false, message: "Purchase order not found." });
  }
  return res.json({ success: true, data: order });
});

module.exports = { createLicenseOrder, listLicenseOrders, getLicenseOrder };
