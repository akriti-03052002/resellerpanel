const asyncHandler = require("express-async-handler");
const { PartnerBankAccount } = require("../models/Index");
const ResellerInvoice = require("../models/ResellerInvoice");
const ResellerBillingConfig = require("../models/ResellerBillingConfig");
const { applyBankVerificationPayment } = require("../services/partnerBankVerification");
const { applyPaidInvoice, markInvoicePaymentFailed } = require("../services/resellerInvoicePaymentFulfillment");
const { applyPaidPrepayment } = require("../services/resellerPrepaymentFulfillment");
const { verifyWebhookSignature } = require("../utils/razorpay");

/* ============================================================
   RAZORPAY WEBHOOK
   Safety net for payments initiated elsewhere in the app: if the payer's
   browser closes (or the network drops) right after Checkout succeeds but
   before the app's own /verify call lands, this is what still gets the
   result applied — Razorpay retries webhook delivery on failure, the
   browser call does not.

   (Partner settlement payouts are always Offline or Razorpay-verify,
   admin-initiated and admin-confirmed — there's no automated payout flow
   needing a webhook here.)

   Mounted in index.js with express.raw() BEFORE the global express.json()
   parser — the signature below is computed over the exact raw bytes
   Razorpay sent, so it must never be re-serialized through JSON.parse
   first.

   Configure this in the Razorpay Dashboard -> Webhooks:
     URL: <your API base>/api/webhooks/razorpay
     Secret: same value as RAZORPAY_WEBHOOK_SECRET in .env
     Events: payment.captured, payment.failed
     (doubles as the safety net for the partner's ₹1 bank verification
     payment — distinguished by payment.notes.purpose ===
     "partner_bank_verification", see
     partnerBankController.initiateBankVerification — and for Reseller
     payment purposes "reseller_invoice_payment" and "reseller_prepayment",
     see partnerResellerBillingController and adminResellerConfigController
     respectively. License purchases have no payment step of their own
     anymore — accepting a request credits licenses immediately and their
     cost rolls into the next billing-cycle invoice, see
     adminLicenseOrderController.acceptLicenseOrder)
============================================================ */

const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];

  if (!signature || !(await verifyWebhookSignature({ rawBody: req.body, signature }))) {
    return res.status(400).json({ success: false, message: "Invalid webhook signature." });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ success: false, message: "Malformed webhook payload." });
  }

  if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      if (!payment?.order_id) return res.json({ success: true });

      if (payment.notes?.purpose === "partner_bank_verification") {
        const bankAccount = await PartnerBankAccount.findOne({ "razorpayCheck.orderId": payment.order_id });
        if (bankAccount && payment.amount === 100) {
          await applyBankVerificationPayment(bankAccount, payment);
        }
        return res.json({ success: true });
      }

      if (payment.notes?.purpose === "reseller_invoice_payment") {
        const invoice = await ResellerInvoice.findOne({ "razorpay.orderId": payment.order_id });
        if (invoice && payment.amount === Math.round(invoice.total * 100)) {
          await applyPaidInvoice(invoice._id, { razorpayPaymentId: payment.id });
        }
        return res.json({ success: true });
      }

      if (payment.notes?.purpose === "reseller_prepayment") {
        const config = await ResellerBillingConfig.findOne({ "prepayment.razorpay.orderId": payment.order_id });
        if (config && payment.amount === Math.round(config.prepayment.amount * 100)) {
          await applyPaidPrepayment(config.partnerId, { razorpayPaymentId: payment.id, method: payment.method });
        }
        return res.json({ success: true });
      }

      return res.json({ success: true });
    } else if (event.event === "payment.failed") {
      const payment = event.payload?.payment?.entity;
      if (!payment?.order_id) return res.json({ success: true });

      if (payment.notes?.purpose === "partner_bank_verification") {
        await PartnerBankAccount.findOneAndUpdate(
          { "razorpayCheck.orderId": payment.order_id, "razorpayCheck.paymentStatus": { $ne: "captured" } },
          {
            $set: {
              "razorpayCheck.paymentStatus": "failed",
              "razorpayCheck.failureReason": payment.error_description || "Payment failed."
            }
          }
        );
        return res.json({ success: true });
      }

      if (payment.notes?.purpose === "reseller_invoice_payment") {
        const invoice = await ResellerInvoice.findOne({ "razorpay.orderId": payment.order_id });
        if (invoice) await markInvoicePaymentFailed(invoice._id);
        return res.json({ success: true });
      }
    }

  return res.json({ success: true });
});

module.exports = { handleRazorpayWebhook };
