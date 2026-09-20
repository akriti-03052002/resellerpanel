const ScreenLicensePurchaseOrder = require("../models/ScreenLicensePurchaseOrder");
const resellerInventory = require("./resellerInventory");
const logActivity = require("../utils/logActivity");

/* ============================================================
   RESELLER LICENSE ORDER FULFILLMENT
   Called when an admin accepts a license request (see
   adminLicenseOrderController.acceptLicenseOrder) — a request only
   ever reaches acceptance once the reseller's one-time prepayment
   is already done, so there's no per-order payment to verify here;
   this just credits the licenses. razorpayPaymentId is passed as
   "" in that case (nothing to record) — the field only holds a
   real value for the historical case where an order was paid
   individually, kept for backward compatibility with old records.
   The atomic status:"created"->"paid" claim below still guards
   against this being called twice for the same order.
============================================================ */

const applyPaidLicenseOrder = async (orderId, { razorpayPaymentId, method } = {}) => {
  // Atomic claim — only the caller that flips status first gets to apply
  // the licenses; a retried/duplicate call finds no matching document
  // (already "paid") and no-ops instead of double-crediting.
  const order = await ScreenLicensePurchaseOrder.findOneAndUpdate(
    { _id: orderId, status: "created" },
    {
      $set: {
        status: "paid",
        orderStatus: "completed",
        "razorpay.paymentId": razorpayPaymentId,
        "razorpay.method": method || ""
      }
    },
    { new: true }
  );

  if (!order) {
    // Already applied (or never existed) — safe no-op, mirrors
    // CustomerPayment's commissionGenerated guard.
    return null;
  }

  await resellerInventory.applyPurchase({
    partnerId: order.partnerId,
    quantity: order.quantity,
    purchaseOrderId: order._id
  });

  order.licensesApplied = true;
  await order.save();

  await logActivity({
    partnerId: order.partnerId,
    performedByType: "system",
    activityType: "license_purchased",
    entityType: "ScreenLicensePurchaseOrder",
    entityId: order._id,
    description: `${order.quantity} screen licenses purchased (order ${order.orderCode || order._id}).`
  });

  return order;
};

module.exports = { applyPaidLicenseOrder };
