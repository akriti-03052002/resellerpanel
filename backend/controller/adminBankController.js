const { PartnerBankAccount, PartnerNotification } = require("../models/Index");
const { decrypt } = require("../utils/encryption");
const logActivity = require("../utils/logActivity");
const { autoActivatePartnerIfVerified } = require("../services/vendorActivation");

/* ============================================================
   ADMIN — BANK ACCOUNT VERIFICATION
============================================================ */

const listPendingBankAccounts = async (req, res) => {
  const accounts = await PartnerBankAccount.find({ "verification.status": "pending" })
    .sort({ createdAt: 1 })
    .populate("partnerId", "partnerCode legalEntity.businessName");

  return res.json({ success: true, data: accounts });
};

const verifyBankAccount = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    if (!["verified", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be 'verified' or 'rejected'." });
    }

    const account = await PartnerBankAccount.findById(req.params.id);

    if (!account) {
      return res.status(404).json({ success: false, message: "Bank account not found." });
    }

    account.verification.status = status;
    account.verification.verifiedBy = req.adminUser._id;
    account.verification.verifiedAt = new Date();
    account.verification.rejectionReason = status === "rejected" ? rejectionReason || "" : "";

    await account.save();

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
  } catch (error) {
    console.error("verifyBankAccount error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong reviewing the bank account." });
  }
};

/* Decrypts and reveals full account details — every reveal is audit-logged. */
const revealBankAccount = async (req, res) => {
  try {
    const account = await PartnerBankAccount.findById(req.params.id).select("+accountNumberEncrypted +ifscEncrypted");

    if (!account) {
      return res.status(404).json({ success: false, message: "Bank account not found." });
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
  } catch (error) {
    console.error("revealBankAccount error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong revealing the bank account." });
  }
};

module.exports = { listPendingBankAccounts, verifyBankAccount, revealBankAccount };
