const { PartnerBankAccount } = require("../models/Index");
const { encrypt, maskAccountNumber, maskIfsc } = require("../utils/encryption");
const logActivity = require("../utils/logActivity");

/* ============================================================
   PARTNER BANK ACCOUNT
   Raw account number / IFSC are never returned to the client —
   only masked values. Full encrypted fields carry `select: false`
   at the schema level as a second layer of protection.
============================================================ */

const getBankAccount = async (req, res) => {
  const bankAccount = await PartnerBankAccount.findOne({ partnerId: req.partner._id });

  if (!bankAccount) {
    return res.json({ success: true, data: null });
  }

  return res.json({
    success: true,
    data: {
      id: bankAccount._id,
      accountHolderName: bankAccount.accountHolderName,
      bankName: bankAccount.bankName,
      accountNumberLast4: bankAccount.accountNumberLast4,
      ifscMasked: bankAccount.ifscMasked,
      accountType: bankAccount.accountType,
      verification: bankAccount.verification
    }
  });
};

const upsertBankAccount = async (req, res) => {
  try {
    const { accountHolderName, bankName, accountNumber, ifsc, accountType } = req.body;

    if (!accountHolderName || !bankName || !accountNumber || !ifsc || !accountType) {
      return res.status(400).json({ success: false, message: "All bank account fields are required." });
    }

    const payload = {
      accountHolderName,
      bankName,
      accountType,
      accountNumberEncrypted: encrypt(accountNumber),
      accountNumberLast4: maskAccountNumber(accountNumber),
      ifscEncrypted: encrypt(ifsc),
      ifscMasked: maskIfsc(ifsc),
      verification: { status: "pending" },
      security: { encryptedAt: new Date(), keyVersion: "v1" }
    };

    const bankAccount = await PartnerBankAccount.findOneAndUpdate(
      { partnerId: req.partner._id },
      { $set: payload, $setOnInsert: { partnerId: req.partner._id } },
      { returnDocument: "after", upsert: true }
    );

    // Same first-submission transition as document upload — bank details
    // can legitimately be the first thing a partner submits. Kept in its
    // own try/catch: the bank account is already saved above, so a failure
    // here should never make the save look like it failed.
    try {
      if (req.partner.status === "draft") req.partner.status = "pending_verification";
      if (req.partner.verification.overallStatus === "not_submitted") req.partner.verification.overallStatus = "pending";
      await req.partner.save();
    } catch (statusError) {
      console.error("upsertBankAccount: partner status flip failed (bank account was still saved):", statusError);
    }

    await logActivity({
      partnerId: req.partner._id,
      performedByType: "partner_user",
      performedByUserId: req.partnerUser._id,
      activityType: "note",
      entityType: "PartnerBankAccount",
      entityId: bankAccount._id,
      description: `${req.partnerUser.name} added/updated bank account details.`,
      req
    });

    return res.json({
      success: true,
      message: "Bank account saved. It will be verified before payouts are settled.",
      data: {
        id: bankAccount._id,
        accountNumberLast4: bankAccount.accountNumberLast4,
        ifscMasked: bankAccount.ifscMasked,
        verification: bankAccount.verification
      }
    });
  } catch (error) {
    console.error("upsertBankAccount error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong saving the bank account." });
  }
};

module.exports = { getBankAccount, upsertBankAccount };
