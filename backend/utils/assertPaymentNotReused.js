const ScreenLicensePurchaseOrder = require("../models/ScreenLicensePurchaseOrder");
const ResellerInvoice = require("../models/ResellerInvoice");
const ResellerBillingConfig = require("../models/ResellerBillingConfig");

/* ============================================================
   Guards every "offline" payment-verification path (an admin
   manually checking a claimed Razorpay payment ID against a bank
   transfer/reference) against the same real payment being applied
   twice — to two different orders, to a different partner's
   one-time prepayment, etc. The online checkout path doesn't need
   this: Razorpay's own orderId is unique per attempt and already
   enforced unique in our schema, so one Razorpay order can only
   ever be paid once. Offline entry has no such structural
   protection since the admin types the id in by hand — this is
   that protection.
============================================================ */

class PaymentAlreadyUsedError extends Error {
  constructor() {
    super("This payment has already been applied elsewhere — it can't be used again.");
    this.statusCode = 409;
  }
}

const assertPaymentNotReused = async (paymentId) => {
  if (!paymentId) return;

  const [existingOrder, existingInvoice, existingPrepayment] = await Promise.all([
    ScreenLicensePurchaseOrder.exists({ "razorpay.paymentId": paymentId }),
    ResellerInvoice.exists({ "razorpay.paymentId": paymentId }),
    ResellerBillingConfig.exists({ "prepayment.razorpay.paymentId": paymentId })
  ]);

  if (existingOrder || existingInvoice || existingPrepayment) {
    throw new PaymentAlreadyUsedError();
  }
};

module.exports = { assertPaymentNotReused, PaymentAlreadyUsedError };
