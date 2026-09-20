const asyncHandler = require("express-async-handler");
const { PartnerBankAccount, PartnerNotification } = require("../models/Index");
const { decrypt } = require("../utils/encryption");
const logActivity = require("../utils/logActivity");
const { autoActivatePartnerIfVerified } = require("../services/vendorActivation");

/* ============================================================
   ADMIN — BANK ACCOUNT VERIFICATION
============================================================ */

const listPendingBankAccounts = async (req, res) => {
  const accounts = await PartnerBankAccount.find({
    $or: [{ "verification.status": "pending" }, { pendingChange: { $ne: null } }]
  })
    .sort({ createdAt: 1 })
    .populate("partnerId", "partnerCode legalEntity.businessName");

  return res.json({ success: true, data: accounts });
};

const verifyBankAccount = asyncHandler(async (req, res) => {
  const { status, rejectionReason, overrideReason } = req.body;

  if (!["verified", "rejected"].includes(status)) {
    return res.status(400).json({ success: false, message: "Status must be 'verified' or 'rejected'." });
  }

  const account = await PartnerBankAccount.findById(req.params.id);

  if (!account) {
    return res.status(404).json({ success: false, message: "Bank account not found." });
  }

  // The automated Razorpay check (₹1 verification payment) has to have
  // actually passed before an admin can mark this "verified" — unless
  // they explicitly override with a reason (e.g. the partner paid via
  // UPI/card so the bank couldn't be auto-matched, or a legitimate name
  // mismatch). Doesn't apply to rejections.
  const razorpayPassed = account.razorpayCheck?.paymentStatus === "captured" && account.razorpayCheck?.nameMatchStatus === "matched";

  if (status === "verified" && !razorpayPassed && !overrideReason?.trim()) {
    return res.status(400).json({
        success: false,
        message: "The Razorpay bank check hasn't passed yet (payment not captured or the name doesn't match). Ask the partner to run/re-run verification, or provide an override reason to proceed anyway."
      });
  }

  account.verification.status = status;
  account.verification.verifiedBy = req.adminUser._id;
  account.verification.verifiedAt = new Date();
  account.verification.rejectionReason = status === "rejected" ? rejectionReason || "" : "";
  account.verification.overrideReason = status === "verified" && !razorpayPassed ? overrideReason.trim() : "";

  await account.save();

  if (status === "verified" && !razorpayPassed) {
    await logActivity({
        partnerId: account.partnerId,
        performedByType: "spotx_user",
        performedByUserId: req.adminUser._id,
        activityType: "note",
        entityType: "PartnerBankAccount",
        entityId: account._id,
        description: `${req.adminUser.name} verified this bank account despite the Razorpay check not passing. Override reason: ${account.verification.overrideReason}`,
        req
      });
  }

  await logActivity({
      partnerId: account.partnerId,
      performedByType: "spotx_user",
      performedByUserId: req.adminUser._id,
      activityType: "note",
      entityType: "PartnerBankAccount",
      entityId: account._id,
      description: `${req.adminUser.name} marked the bank account as ${status}.`,
      req
    });

  await PartnerNotification.create({
      partnerId: account.partnerId,
      type: "bank_verified",
      title: `Bank account ${status}`,
      message: status === "rejected" && rejectionReason
      ? `Your bank account was rejected: ${rejectionReason}`
      : `Your bank account was ${status}.`,
      entity: { type: "PartnerBankAccount", entityId: account._id }
    });

  if (status === "verified") {
    await autoActivatePartnerIfVerified(account.partnerId, req.adminUser._id);
  }

  return res.json({ success: true, message: "Bank account reviewed.", data: account });
});

/* Decrypts and reveals full account details — every reveal is audit-logged. */
const revealBankAccount = asyncHandler(async (req, res) => {
  const account = await PartnerBankAccount.findById(req.params.id).select("+accountNumberEncrypted +ifscEncrypted +pendingChange.accountNumberEncrypted +pendingChange.ifscEncrypted");

  if (!account) {
    return res.status(404).json({ success: false, message: "Bank account not found." });
  }

  // Reveal the pending change's details instead of the live ones when
  // asked — that's what an admin is actually reviewing when one exists.
  if (req.query.pending === "true") {
    if (!account.pendingChange) {
      return res.status(404).json({ success: false, message: "This bank account has no pending change to reveal." });
    }

    const accountNumber = decrypt(account.pendingChange.accountNumberEncrypted);
    const ifsc = decrypt(account.pendingChange.ifscEncrypted);

    account.security.lastAccessedAt = new Date();
    account.security.lastAccessedBy = req.adminUser._id;
    await account.save();

    await logActivity({
        partnerId: account.partnerId,
        performedByType: "spotx_user",
        performedByUserId: req.adminUser._id,
        activityType: "bank_details_accessed",
        entityType: "PartnerBankAccount",
        entityId: account._id,
        description: `${req.adminUser.name} viewed full details of a pending bank account change.`,
        req
      });

    return res.json({
        success: true,
        data: { accountNumber, ifsc, accountHolderName: account.pendingChange.accountHolderName, bankName: account.pendingChange.bankName }
      });
  }

  // Once verified, there's no review decision left to make — keep the
  // full account number/IFSC out of reach from that point on rather than
  // leaving them viewable indefinitely.
  if (account.verification.status === "verified") {
    return res.status(403).json({ success: false, message: "This bank account is already verified — full details can no longer be viewed." });
  }

  const accountNumber = decrypt(account.accountNumberEncrypted);
  const ifsc = decrypt(account.ifscEncrypted);

  account.security.lastAccessedAt = new Date();
  account.security.lastAccessedBy = req.adminUser._id;
  await account.save();

  await logActivity({
      partnerId: account.partnerId,
      performedByType: "spotx_user",
      performedByUserId: req.adminUser._id,
      activityType: "bank_details_accessed",
      entityType: "PartnerBankAccount",
      entityId: account._id,
      description: `${req.adminUser.name} viewed full bank account details.`,
      req
    });

  return res.json({
      success: true,
      data: { accountNumber, ifsc, accountHolderName: account.accountHolderName, bankName: account.bankName }
    });
});

/* ============================================================
   ADMIN — PENDING BANK ACCOUNT CHANGE (approve / reject)
   Reviews a staged update to an account that already has live, on-file
   bank details (see partnerBankController.upsertBankAccount). Distinct
   from verifyBankAccount above, which reviews a brand-new account's
   very first submission.
============================================================ */

const approveBankAccountChange = asyncHandler(async (req, res) => {
  const { overrideReason } = req.body;

  const account = await PartnerBankAccount.findById(req.params.id)
    .select("+pendingChange.accountNumberEncrypted +pendingChange.ifscEncrypted");

  if (!account) {
    return res.status(404).json({ success: false, message: "Bank account not found." });
  }

  if (!account.pendingChange) {
    return res.status(400).json({ success: false, message: "This bank account has no pending change to approve." });
  }

  const pending = account.pendingChange;
  const razorpayPassed = pending.razorpayCheck?.paymentStatus === "captured" && pending.razorpayCheck?.nameMatchStatus === "matched";

  if (!razorpayPassed && !overrideReason?.trim()) {
    return res.status(400).json({
        success: false,
        message: "The Razorpay bank check hasn't passed yet for this pending change (payment not captured or the name doesn't match). Ask the partner to run/re-run verification, or provide an override reason to proceed anyway."
      });
  }

  account.accountHolderName = pending.accountHolderName;
  account.bankName = pending.bankName;
  account.accountNumberEncrypted = pending.accountNumberEncrypted;
  account.accountNumberLast4 = pending.accountNumberLast4;
  account.ifscEncrypted = pending.ifscEncrypted;
  account.ifscMasked = pending.ifscMasked;
  account.accountType = pending.accountType;
  account.cancelledChequeDocumentId = pending.cancelledChequeDocumentId;
  account.razorpayCheck = pending.razorpayCheck;
  account.security.encryptedAt = new Date();
  account.security.keyVersion = "v1";

  account.verification.status = "verified";
  account.verification.verifiedBy = req.adminUser._id;
  account.verification.verifiedAt = new Date();
  account.verification.rejectionReason = "";
  account.verification.overrideReason = !razorpayPassed ? overrideReason.trim() : "";

  account.pendingChange = null;

  await account.save();

  await logActivity({
      partnerId: account.partnerId,
      performedByType: "spotx_user",
      performedByUserId: req.adminUser._id,
      activityType: "note",
      entityType: "PartnerBankAccount",
      entityId: account._id,
      description: `${req.adminUser.name} approved a pending bank account change${!razorpayPassed ? ` despite the Razorpay check not passing. Override reason: ${account.verification.overrideReason}` : ""}.`,
      req
    });

  await PartnerNotification.create({
      partnerId: account.partnerId,
      type: "bank_update_approved",
      title: "Bank account update approved",
      message: "Your bank account update was reviewed and approved. Your payout details have been updated.",
      entity: { type: "PartnerBankAccount", entityId: account._id }
    });

  await autoActivatePartnerIfVerified(account.partnerId, req.adminUser._id);

  return res.json({ success: true, message: "Bank account change approved.", data: account });
});

const rejectBankAccountChange = asyncHandler(async (req, res) => {
  const { rejectionReason } = req.body;

  const account = await PartnerBankAccount.findById(req.params.id);

  if (!account) {
    return res.status(404).json({ success: false, message: "Bank account not found." });
  }

  if (!account.pendingChange) {
    return res.status(400).json({ success: false, message: "This bank account has no pending change to reject." });
  }

  account.pendingChange = null;
  await account.save();

  await logActivity({
      partnerId: account.partnerId,
      performedByType: "spotx_user",
      performedByUserId: req.adminUser._id,
      activityType: "note",
      entityType: "PartnerBankAccount",
      entityId: account._id,
      description: `${req.adminUser.name} rejected a pending bank account change.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
      req
    });

  await PartnerNotification.create({
      partnerId: account.partnerId,
      type: "bank_update_rejected",
      title: "Bank account update rejected",
      message: rejectionReason
        ? `Your bank account update was rejected: ${rejectionReason}`
        : "Your bank account update was rejected. Your existing payout details remain unchanged.",
      entity: { type: "PartnerBankAccount", entityId: account._id }
    });

  return res.json({ success: true, message: "Bank account change rejected.", data: account });
});

module.exports = { listPendingBankAccounts, verifyBankAccount, revealBankAccount, approveBankAccountChange, rejectBankAccountChange };
