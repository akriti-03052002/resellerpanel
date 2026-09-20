const asyncHandler = require("express-async-handler");
const Partner = require("../models/Partner");
const ResellerInventory = require("../models/ResellerInventory");
const ResellerCustomer = require("../models/ResellerCustomer");
const CustomerAllocation = require("../models/CustomerAllocation");
const ResellerInvoice = require("../models/ResellerInvoice");
const { runBillingForAllPartners, markOverdueInvoices } = require("../services/resellerBilling");
const { runResellerNotificationChecks } = require("../services/resellerNotifications");
const { applyPaidInvoice } = require("../services/resellerInvoicePaymentFulfillment");
const resellerInventory = require("../services/resellerInventory");
const { fetchPaymentById } = require("../utils/razorpay");
const { assertPaymentNotReused } = require("../utils/assertPaymentNotReused");
const logActivity = require("../utils/logActivity");

/* ============================================================
   ADMIN — RESELLER (CROSS-PARTNER DASHBOARD + DETAIL + BILLING RUN)
============================================================ */

// Cross-partner view of every reseller's own end customers — admin has no
// role in managing them (that's the reseller's job), this is read-only
// oversight only. Optional `search` (company/contact/email) and `status`
// filters; `partnerId` narrows to one reseller (used from the partner
// detail page, if ever needed there).
const listAllCustomers = asyncHandler(async (req, res) => {
  const { search, status, partnerId } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (partnerId) filter.partnerId = partnerId;
  if (search) {
    const re = new RegExp(search.trim(), "i");
    filter.$or = [
      { "businessDetails.companyName": re },
      { "contactDetails.name": re },
      { "contactDetails.email": re }
    ];
  }

  const customers = await ResellerCustomer.find(filter)
    .populate("partnerId", "legalEntity.businessName partnerCode")
    .sort({ createdAt: -1 })
    .lean();

  const customerIds = customers.map((c) => c._id);
  const allocations = await CustomerAllocation.find({ customerId: { $in: customerIds }, status: { $ne: "cancelled" } }).lean();

  const allocationByCustomer = new Map(allocations.map((a) => [String(a.customerId), a]));

  const data = customers.map((c) => {
    const allocation = allocationByCustomer.get(String(c._id));
    return {
      ...c,
      allocation: allocation
        ? {
            allocatedLicenses: allocation.allocatedLicenses,
            registeredScreens: allocation.registeredScreens,
            activeScreens: allocation.activeScreens,
            suspendedScreens: allocation.suspendedScreens
          }
        : null
    };
  });

  return res.json({ success: true, data });
});

const getDashboard = asyncHandler(async (req, res) => {
  const partners = await Partner.find({ partnerType: "reseller" }).select("_id status");
  const partnerIds = partners.map((p) => p._id);

  const inventories = await ResellerInventory.find({ partnerId: { $in: partnerIds } });

  const totals = inventories.reduce(
    (acc, inv) => {
      acc.totalPurchased += inv.totalPurchasedLicenses;
      acc.totalAllocated += inv.totalAllocatedLicenses;
      acc.totalActive += inv.totalActiveScreens;
      acc.totalAvailable += Math.max(0, inv.totalPurchasedLicenses - inv.totalAllocatedLicenses);
      return acc;
    },
    { totalPurchased: 0, totalAllocated: 0, totalActive: 0, totalAvailable: 0 }
  );

  const [pendingInvoices, overdueInvoices, failedInvoices] = await Promise.all([
      ResellerInvoice.countDocuments({ partnerId: { $in: partnerIds }, paymentStatus: "pending" }),
      ResellerInvoice.countDocuments({ partnerId: { $in: partnerIds }, paymentStatus: "overdue" }),
      ResellerInvoice.countDocuments({ partnerId: { $in: partnerIds }, paymentStatus: "failed" })
    ]);

  return res.json({
      success: true,
      data: {
        totalPartners: partners.length,
        suspendedPartners: partners.filter((p) => p.status === "suspended").length,
        ...totals,
        pendingInvoices,
        overdueInvoices,
        failedInvoices
      }
    });
});

const getPartnerDetail = asyncHandler(async (req, res) => {
  const partner = await Partner.findById(req.params.id);
  if (!partner || partner.partnerType !== "reseller") {
    return res.status(404).json({ success: false, message: "Reseller partner not found." });
  }

  const [inventory, customerCounts, invoices] = await Promise.all([
      resellerInventory.getOrCreateInventory(partner._id),
      ResellerCustomer.aggregate([
        { $match: { partnerId: partner._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      ResellerInvoice.find({ partnerId: partner._id }).sort({ createdAt: -1 }).limit(12)
    ]);

  return res.json({
      success: true,
      data: {
        partner,
        inventory,
        customerCounts: customerCounts.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {}),
        invoices
      }
    });
});

// Manual for this release — see RESELLER_COMPLETE_PLAN.md B12 item 1.
// Idempotent per partner/period via ResellerInvoice's unique index, so
// wiring this to a scheduler later is a matter of calling the same
// service from a cron trigger.
const runBillingNow = asyncHandler(async (req, res) => {
  const results = await runBillingForAllPartners({ performedByUserId: req.adminUser._id });
  // Overdue-marking + due-date reminders/low-inventory alerts are
  // cheapest to check right after billing runs, since that's exactly
  // when new invoices/updated balances exist — the endpoint below also
  // runs these standalone for days no billing run happens.
  const overdueMarked = await markOverdueInvoices();
  const notifications = await runResellerNotificationChecks();
  return res.json({ success: true, message: "Reseller billing run complete.", data: { results, overdueMarked, notifications } });
});

// Standalone trigger for overdue-marking + the three notification checks
// (due-date reminders, low-inventory alerts, agreement-expiring flags) —
// useful on days no billing run happens. No scheduler exists yet (see
// B12 item 1), so this is an admin-clicked action for now.
const checkNotifications = asyncHandler(async (req, res) => {
  const overdueMarked = await markOverdueInvoices();
    const notifications = await runResellerNotificationChecks();
    return res.json({ success: true, message: "Notification checks complete.", data: { overdueMarked, ...notifications } });
});

// Superadmin-only manual inventory correction, always logged with a
// reason and applied through the same invariant-guarded service as
// every other inventory mutation — never a direct write.
const adjustInventory = asyncHandler(async (req, res) => {
  try {
    const partner = await Partner.findById(req.params.id);
    if (!partner || partner.partnerType !== "reseller") {
      return res.status(404).json({ success: false, message: "Reseller partner not found." });
    }

    const { quantity, reason } = req.body;
    if (!quantity || !reason) {
      return res.status(400).json({ success: false, message: "quantity and reason are both required." });
    }

    const inventory = await resellerInventory.adjust({
      partnerId: partner._id,
      quantity: parseInt(quantity, 10),
      reason,
      createdBy: req.adminUser._id
    });

    await logActivity({
      partnerId: partner._id,
      performedByType: "spotx_user",
      performedByUserId: req.adminUser._id,
      activityType: "license_adjusted",
      entityType: "ResellerInventory",
      entityId: inventory._id,
      description: `Manual inventory adjustment: ${quantity > 0 ? "+" : ""}${quantity} licenses — ${reason}`,
      req
    });

    return res.json({ success: true, message: "Inventory adjusted.", data: inventory });
  } catch (error) {
    console.error("adjustInventory error:", error);
    return res.status(400).json({ success: false, message: error.message || "Something went wrong adjusting inventory." });
  }
});

// Every invoice defaults to "offline" (see ResellerInvoice.paymentMode) —
// SPOTX collects it manually. Switching an invoice to "online" is what
// unlocks the reseller's own "Pay Now" button on their Billing page
// (still gated by the payment window — see
// partnerResellerBillingController.attachPayWindow). Mirrors
// adminResellerConfigController.setPrepayment's online branch.
const setInvoicePaymentMode = asyncHandler(async (req, res) => {
  const invoice = await ResellerInvoice.findById(req.params.id);
  if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found." });

  if (invoice.paymentStatus === "paid") {
    return res.status(400).json({ success: false, message: "This invoice is already paid." });
  }
  if (invoice.paymentMode === "online") {
    return res.status(400).json({ success: false, message: "This invoice is already set for online payment." });
  }

  invoice.paymentMode = "online";
  invoice.onlineRequested = false;
  await invoice.save();

  await logActivity({
      partnerId: invoice.partnerId,
      performedByType: "spotx_user",
      performedByUserId: req.adminUser._id,
      activityType: "note",
      entityType: "ResellerInvoice",
      entityId: invoice._id,
      description: `${req.adminUser.name} switched invoice ${invoice.invoiceNumber} to online payment — the reseller can now pay it from their panel.`,
      req
    });

  return res.json({ success: true, message: "Invoice switched to online payment.", data: invoice });
});

// Admin already has a transaction reference for a payment made outside
// the app — checked against Razorpay directly and applied immediately if
// it's captured and the amount matches. Same online/offline verification
// pattern as adminResellerConfigController.setPrepayment's offline branch
// and the (now-removed) per-order offline flow — reused here at the
// invoice level via the shared assertPaymentNotReused guard against one
// real payment being credited to two different invoices by mistake.
const verifyInvoiceOfflinePayment = asyncHandler(async (req, res) => {
  try {
    const invoice = await ResellerInvoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found." });

    if (invoice.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "This invoice is already paid." });
    }

    const { transactionId } = req.body;
    if (!transactionId?.trim()) {
      return res.status(400).json({ success: false, message: "Enter the Razorpay payment ID to verify this offline payment." });
    }

    const payment = await fetchPaymentById(transactionId.trim());

    if (payment.status !== "captured") {
      return res.status(400).json({
        success: false,
        message: `This payment shows as "${payment.status}" on Razorpay, not captured — it can't be verified yet.`
      });
    }

    if (payment.amount !== Math.round(invoice.total * 100)) {
      return res.status(400).json({
        success: false,
        message: `This payment's amount (₹${(payment.amount / 100).toLocaleString("en-IN")}) doesn't match the invoice total (₹${invoice.total.toLocaleString("en-IN")}).`
      });
    }

    await assertPaymentNotReused(payment.id);

    invoice.offlinePayment = {
      transactionId: transactionId.trim(),
      verifiedBy: req.adminUser._id,
      verifiedAt: new Date()
    };
    await invoice.save();

    const applied = await applyPaidInvoice(invoice._id, { razorpayPaymentId: payment.id });
    if (!applied) {
      return res.status(409).json({ success: false, message: "This invoice was already processed." });
    }

    await logActivity({
      partnerId: invoice.partnerId,
      performedByType: "spotx_user",
      performedByUserId: req.adminUser._id,
      activityType: "note",
      entityType: "ResellerInvoice",
      entityId: invoice._id,
      description: `${req.adminUser.name} verified an offline payment (ref: ${transactionId.trim()}) for invoice ${invoice.invoiceNumber}.`,
      req
    });

    return res.json({ success: true, message: "Payment verified — invoice marked paid.", data: applied });
  } catch (error) {
    console.error("verifyInvoiceOfflinePayment error:", error);
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : "Something went wrong verifying this payment." });
  }
});

module.exports = {
  listAllCustomers, getDashboard, getPartnerDetail, runBillingNow, checkNotifications, adjustInventory,
  setInvoicePaymentMode, verifyInvoiceOfflinePayment
};
