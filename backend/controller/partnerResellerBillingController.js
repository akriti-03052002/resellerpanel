const ResellerInvoice = require("../models/ResellerInvoice");
const ResellerBillingConfig = require("../models/ResellerBillingConfig");
const { estimateCurrentDue, getInvoiceLineItems } = require("../services/resellerBilling");
const { applyPaidInvoice } = require("../services/resellerInvoicePaymentFulfillment");
const { applyPaidPrepayment } = require("../services/resellerPrepaymentFulfillment");
const { createOrder, verifyPaymentSignature, fetchPaymentById } = require("../utils/razorpay");
const { getRazorpayCredentials } = require("../utils/paymentGatewayConfig");
const logActivity = require("../utils/logActivity");
const asyncHandler = require("express-async-handler");

/* ============================================================
   PARTNER — RESELLER BILLING
   Lists ResellerInvoice records (SPOTX -> Reseller) and pays one
   via Razorpay. No PDF/GST document generated here — the
   Reseller's GST/business documents are submitted once at KYC
   (RESELLER_COMPLETE_PLAN.md B15 item 4).

   An invoice is only payable by the reseller themselves when BOTH:
     1. paymentMode === "online" (an admin has to switch it on — see
        adminInvoiceController.setInvoicePaymentMode; it defaults to
        "offline", meaning SPOTX collects it manually), and
     2. today is within the payment window — dueDateReminderDaysBefore
        days before dueDate, same config knob already used for the
        due-date-reminder notification (RESELLER_COMPLETE_PLAN.md
        B15 item 6) — so "Pay Now" doesn't appear the moment the
        cycle closes, only once it's actually close to due.
   `canPayNow`/`paymentWindowOpensAt` are computed fresh on every
   read below, never stored, so they can't go stale.
============================================================ */

const attachPayWindow = (invoiceDoc, dueDateReminderDaysBefore) => {
  const invoice = invoiceDoc.toObject ? invoiceDoc.toObject() : invoiceDoc;
  const paymentWindowOpensAt = new Date(invoice.dueDate.getTime() - dueDateReminderDaysBefore * 24 * 60 * 60 * 1000);
  const canPayNow = invoice.paymentMode === "online" && invoice.paymentStatus !== "paid" && new Date() >= paymentWindowOpensAt;
  return { ...invoice, paymentWindowOpensAt, canPayNow };
};

const listInvoices = asyncHandler(async (req, res) => {
  const [invoices, config] = await Promise.all([
    ResellerInvoice.find({ partnerId: req.partner._id }).sort({ createdAt: -1 }),
    ResellerBillingConfig.findOne({ partnerId: req.partner._id })
  ]);
  const dueDateReminderDaysBefore = config?.dueDateReminderDaysBefore ?? 3;
  return res.json({ success: true, data: invoices.map((i) => attachPayWindow(i, dueDateReminderDaysBefore)) });
});

// Read-only preview of the current cycle's running total — the reseller's
// Billing page shows this whenever there's no open invoice yet, so they
// can see what they currently owe before the cycle closes.
const getCurrentDueEstimate = asyncHandler(async (req, res) => {
  const estimate = await estimateCurrentDue(req.partner._id);
  return res.json({ success: true, data: estimate });
});

const getInvoice = asyncHandler(async (req, res) => {
  const [invoice, config] = await Promise.all([
      ResellerInvoice.findOne({ _id: req.params.id, partnerId: req.partner._id }),
      ResellerBillingConfig.findOne({ partnerId: req.partner._id })
    ]);
  if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found." });

  const lineItems = await getInvoiceLineItems(invoice);
  const withWindow = attachPayWindow(invoice, config?.dueDateReminderDaysBefore ?? 3);

  return res.json({ success: true, data: { ...withWindow, ...lineItems } });
});

// Reseller-side ask to have a specific offline invoice switched to
// online so they can pay it themselves instead of waiting for SPOTX to
// collect it manually — the admin still has to act on this (see
// adminInvoiceController.setInvoicePaymentMode), this just raises the flag.
const requestOnlinePayment = asyncHandler(async (req, res) => {
  const invoice = await ResellerInvoice.findOne({ _id: req.params.id, partnerId: req.partner._id });
  if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found." });

  if (invoice.paymentMode === "online") {
    return res.status(400).json({ success: false, message: "This invoice is already set for online payment." });
  }
  if (invoice.paymentStatus === "paid") {
    return res.status(400).json({ success: false, message: "This invoice is already paid." });
  }

  invoice.onlineRequested = true;
  invoice.onlineRequestedAt = new Date();
  await invoice.save();

  await logActivity({
      partnerId: req.partner._id,
      performedByType: "partner_user",
      performedByUserId: req.partnerUser?._id,
      activityType: "note",
      entityType: "ResellerInvoice",
      entityId: invoice._id,
      description: `Requested online payment for invoice ${invoice.invoiceNumber} — awaiting SPOTX to switch it on.`
    });

  return res.json({ success: true, message: "Request sent — SPOTX will review it shortly.", data: invoice });
});

const createInvoicePaymentOrder = asyncHandler(async (req, res) => {
  const [invoice, config] = await Promise.all([
      ResellerInvoice.findOne({ _id: req.params.id, partnerId: req.partner._id }),
      ResellerBillingConfig.findOne({ partnerId: req.partner._id })
    ]);
  if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found." });

  if (invoice.paymentStatus === "paid") {
    return res.status(400).json({ success: false, message: "This invoice is already paid." });
  }

  const { canPayNow, paymentWindowOpensAt } = attachPayWindow(invoice, config?.dueDateReminderDaysBefore ?? 3);
  if (!canPayNow) {
    const message = invoice.paymentMode !== "online"
        ? "This invoice is set to be collected offline by SPOTX. Request online payment first if you'd like to pay it yourself."
        : `Online payment for this invoice opens on ${paymentWindowOpensAt.toDateString()}.`;
    return res.status(400).json({ success: false, message });
  }

  const razorpayOrder = await createOrder({
      amountInRupees: invoice.total,
      receipt: `resellerinv_${invoice._id}`,
      notes: {
        purpose: "reseller_invoice_payment",
        partnerId: String(req.partner._id),
        invoiceId: String(invoice._id)
      }
    });

  invoice.razorpay.orderId = razorpayOrder.id;
  await invoice.save();

  const { keyId } = await getRazorpayCredentials();

  return res.json({
      success: true,
      data: { razorpayOrderId: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency, keyId }
    });
});

const verifyInvoicePayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  const invoice = await ResellerInvoice.findOne({ _id: req.params.id, partnerId: req.partner._id });
  if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found." });

  const isValidSignature = await verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature
    });

  if (!isValidSignature) {
    return res.status(400).json({ success: false, message: "Payment verification failed." });
  }

  const payment = await fetchPaymentById(razorpayPaymentId);

  // A valid signature already proves Razorpay completed this checkout —
  // it's only ever produced for a successful payment. If their own
  // payment-lookup API hasn't caught up yet (a few seconds' lag is
  // common right after Checkout closes), don't tell the partner their
  // payment failed: leave the invoice as "pending" and let the webhook
  // (which Razorpay retries until it succeeds) apply it once their side
  // settles — usually within a few minutes. Only a captured payment
  // whose amount doesn't match is a genuine mismatch worth surfacing.
  if (payment.status !== "captured") {
    return res.json({
        success: true,
        pending: true,
        message: "Your payment is being confirmed — this can take a few minutes. We'll update this invoice automatically once it's done."
      });
  }

  if (payment.amount !== Math.round(invoice.total * 100)) {
    return res.status(400).json({ success: false, message: "Payment could not be verified against the invoice amount." });
  }

  await applyPaidInvoice(invoice._id, { razorpayPaymentId });

  const updated = await ResellerInvoice.findById(invoice._id);
  return res.json({ success: true, message: "Payment confirmed.", data: updated });
});

// One-time prepayment — GET so the reseller's panel can show its status
// (not_done / awaiting_payment / done) without a separate model to fetch.
const getPrepaymentStatus = asyncHandler(async (req, res) => {
  const config = await ResellerBillingConfig.findOne({ partnerId: req.partner._id });
  return res.json({
    success: true,
    data: config?.prepayment || { status: "not_done" }
  });
});

const createPrepaymentOrder = asyncHandler(async (req, res) => {
  const config = await ResellerBillingConfig.findOne({ partnerId: req.partner._id });

  if (!config || config.prepayment?.status !== "awaiting_payment") {
    return res.status(400).json({ success: false, message: "There's no prepayment awaiting your payment right now." });
  }

  let razorpayOrderId = config.prepayment.razorpay?.orderId;

  if (!razorpayOrderId) {
    const razorpayOrder = await createOrder({
        amountInRupees: config.prepayment.amount,
        receipt: `resellerprepay_${config._id}`,
        notes: {
          purpose: "reseller_prepayment",
          partnerId: String(req.partner._id)
        }
      });

    config.prepayment.razorpay = { ...config.prepayment.razorpay, orderId: razorpayOrder.id };
    await config.save();
    razorpayOrderId = razorpayOrder.id;
  }

  const { keyId } = await getRazorpayCredentials();

  return res.json({
      success: true,
      data: {
        razorpayOrderId,
        amount: Math.round(config.prepayment.amount * 100),
        currency: config.prepayment.currency || "INR",
        keyId
      }
    });
});

const verifyPrepaymentPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  const config = await ResellerBillingConfig.findOne({ partnerId: req.partner._id });
  if (!config || config.prepayment?.status !== "awaiting_payment") {
    return res.status(400).json({ success: false, message: "There's no prepayment awaiting your payment right now." });
  }

  const isValidSignature = await verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature
    });

  if (!isValidSignature) {
    return res.status(400).json({ success: false, message: "Payment verification failed." });
  }

  const payment = await fetchPaymentById(razorpayPaymentId);

  // Same lag-tolerant handling as verifyInvoicePayment — a valid
  // signature already proves this was a successful checkout.
  if (payment.status !== "captured") {
    return res.json({
        success: true,
        pending: true,
        message: "Your payment is being confirmed — this can take a few minutes. We'll unlock license purchases automatically once it's done."
      });
  }

  if (payment.amount !== Math.round(config.prepayment.amount * 100)) {
    return res.status(400).json({ success: false, message: "Payment could not be verified against the prepayment amount." });
  }

  const updated = await applyPaidPrepayment(req.partner._id, { razorpayPaymentId, method: payment.method });
  if (!updated) {
    return res.status(409).json({ success: false, message: "This prepayment was already processed." });
  }

  return res.json({ success: true, message: "Prepayment confirmed — you can now buy licenses.", data: updated.prepayment });
});

module.exports = {
  listInvoices, getInvoice, getCurrentDueEstimate, requestOnlinePayment, createInvoicePaymentOrder, verifyInvoicePayment,
  getPrepaymentStatus, createPrepaymentOrder, verifyPrepaymentPayment
};
