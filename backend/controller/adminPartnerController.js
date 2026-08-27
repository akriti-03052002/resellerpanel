const bcrypt = require("bcryptjs");

const { Partner, PartnerDocument, PartnerBankAccount, PartnerUser, PartnerNotification } = require("../models/Index");
const { generatePartnerCode, generateReferralCode } = require("../utils/generateCode");
const { ROLE_PERMISSIONS } = require("../config/roles");
const logActivity = require("../utils/logActivity");
const { assignReferralCode } = require("../services/vendorActivation");
const { attachPartnerAgreement } = require("../services/generatePartnerAgreement");
const { autoAssignVendorTier } = require("../services/tierAssignment");
const { getRequiredDocumentTypes } = require("../utils/partnerVerification");
const { sendMail } = require("../utils/mailer");

/* ============================================================
   ADMIN — PARTNER MANAGEMENT
============================================================ */

// Method 2 from the spec: an admin onboards a partner on their behalf
// (no self-registration) — same minimal fields as partnerAuthController.
// registerPartner (type, name, email, phone) minus the promo-program join
// step (that's a self-service concept). Unlike a customer invite, the admin
// types the partner's login password directly here (partners get limited
// panel access, so there's no self-serve "set your password" email link).
// Business name, legal details, address, KYC docs and bank all get filled
// in later from the partner's own Profile page.
const createPartner = async (req, res) => {
  try {
    const { partnerType, contactName, email, phone, password } = req.body;

    if (!partnerType || !contactName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Partner type, name, email, phone and password are required."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    const existingUser = await PartnerUser.findOne({ email: email.toLowerCase().trim() });

    if (existingUser) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    const partnerCode = generatePartnerCode();

    let referralCode;

    if (partnerType !== "vendor") {
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = generateReferralCode();
        // eslint-disable-next-line no-await-in-loop
        const taken = await Partner.exists({ "referral.referralCode": candidate });
        if (!taken) {
          referralCode = candidate;
          break;
        }
      }

      if (!referralCode) {
        return res.status(500).json({
          success: false,
          message: "Could not generate a unique referral code right now. Please try again."
        });
      }
    }

    const partner = await Partner.create({
      partnerCode,
      partnerType,
      primaryContact: { name: contactName, email: email.toLowerCase().trim(), phone },
      referral: referralCode
        ? { referralCode, referralLink: `${process.env.CLIENT_URL || "http://localhost:5173"}/partner/register?ref=${referralCode}` }
        : undefined,
      verification: { overallStatus: "not_submitted" },
      status: "draft",
      owner: { salesUserId: req.adminUser._id }
    });

    // Admin sets the partner's login password directly — no reset-link
    // email, since partners don't get a self-serve password flow.
    const passwordHash = await bcrypt.hash(password, 12);

    const partnerUser = await PartnerUser.create({
      partnerId: partner._id,
      name: contactName,
      email: email.toLowerCase().trim(),
      phone,
      role: "owner",
      permissions: ROLE_PERMISSIONS.owner,
      status: "active",
      auth: {
        provider: "email",
        passwordHash
      }
    });

    await sendMail({
      to: partnerUser.email,
      subject: "You've been added as a SPOTX Partner",
      text: `${req.adminUser.name} created a SPOTX Partner account for you. Log in with your email and the password you were given.`,
      html: `
        <p>${req.adminUser.name} created a SPOTX Partner account for you.</p>
        <p>Log in with your email (${partnerUser.email}) and the password you were given.</p>
        <p>Once you're in, complete your business profile and KYC details to get verified.</p>
      `
    });

    await logActivity({
      partnerId: partner._id,
      performedByType: "spotx_user",
      performedByUserId: req.adminUser._id,
      activityType: "status_changed",
      entityType: "Partner",
      entityId: partner._id,
      description: `${req.adminUser.name} created this partner account directly.`,
      req
    });

    return res.status(201).json({
      success: true,
      message: `Partner created. ${partnerUser.email} can now log in with the password you set.`,
      data: { partner }
    });
  } catch (error) {
    console.error("createPartner error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong creating the partner." });
  }
};

const listPartners = async (req, res) => {
  const { status, partnerType, search } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (partnerType) filter.partnerType = partnerType;
  if (search) {
    filter.$or = [
      { "legalEntity.businessName": { $regex: search, $options: "i" } },
      { partnerCode: { $regex: search, $options: "i" } },
      { "primaryContact.email": { $regex: search, $options: "i" } }
    ];
  }

  const partners = await Partner.find(filter).sort({ createdAt: -1 });

  return res.json({ success: true, data: partners });
};

const getPartner = async (req, res) => {
  const partner = await Partner.findById(req.params.id);

  if (!partner) {
    return res.status(404).json({ success: false, message: "Partner not found." });
  }

  const [documents, bankAccount, team] = await Promise.all([
    PartnerDocument.find({ partnerId: partner._id }).sort({ createdAt: -1 }),
    PartnerBankAccount.findOne({ partnerId: partner._id }),
    PartnerUser.find({ partnerId: partner._id })
  ]);

  return res.json({
    success: true,
    data: {
      partner,
      documents,
      requiredDocumentTypes: getRequiredDocumentTypes(partner.partnerType),
      bankAccount: bankAccount
        ? {
            id: bankAccount._id,
            accountHolderName: bankAccount.accountHolderName,
            bankName: bankAccount.bankName,
            accountNumberLast4: bankAccount.accountNumberLast4,
            ifscMasked: bankAccount.ifscMasked,
            verification: bankAccount.verification
          }
        : null,
      team
    }
  });
};

const updatePartnerStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const validStatuses = ["draft", "pending_verification", "under_review", "active", "suspended", "rejected", "inactive"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }

    const partner = await Partner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({ success: false, message: "Partner not found." });
    }

    partner.status = status;

    let generatedReferralCode = null;

    if (status === "active") {
      partner.verification.overallStatus = "verified";
      partner.verification.verifiedBy = req.adminUser._id;
      partner.verification.verifiedAt = new Date();

      // Vendor's customer-signup code — normally auto-generated the moment
      // documents + bank verification both complete (see
      // autoActivateVendorIfVerified). This is the manual-override path:
      // an admin activating a vendor by hand still gets one too.
      if (partner.partnerType === "vendor" && !partner.referral?.referralCode) {
        generatedReferralCode = await assignReferralCode(partner);
      }
    }

    if (status === "rejected") {
      partner.verification.overallStatus = "rejected";
      partner.verification.rejectionReason = rejectionReason || "";
    }

    await partner.save();

    if (status === "active") {
      if (partner.partnerType === "vendor") {
        // Vendor's agreement used to be generated right here off whatever
        // tier the screen-count ladder happened to auto-suggest at this
        // exact moment. Now the admin explicitly confirms/picks the
        // commission rule via assignTier below — this just seeds a
        // sensible default tier for that panel, it doesn't generate
        // anything yet.
        await autoAssignVendorTier(partner);
      } else {
        // Every other partner type still gets one immediately on activation.
        await attachPartnerAgreement(partner, req.adminUser._id);
      }
    }

    if (generatedReferralCode) {
      await PartnerNotification.create({
        partnerId: partner._id,
        type: "referral_code_generated",
        title: "Your customer referral code is ready",
        message: `Your account is verified. Share code ${generatedReferralCode} with customers so they can register under you.`,
        entity: { type: "Partner", entityId: partner._id }
      });
    }

    if (status === "rejected") {
      await PartnerNotification.create({
        partnerId: partner._id,
        type: "partner_rejected",
        title: "Your partner account was rejected",
        message: rejectionReason
          ? `Your partner account was rejected: ${rejectionReason}`
          : "Your partner account was rejected. Contact SPOTX support for details.",
        entity: { type: "Partner", entityId: partner._id }
      });
    }

    await logActivity({
      partnerId: partner._id,
      performedByType: "spotx_user",
      performedByUserId: req.adminUser._id,
      activityType: "status_changed",
      entityType: "Partner",
      entityId: partner._id,
      description: `${req.adminUser.name} changed partner status to ${status}.`,
      req
    });

    return res.json({ success: true, message: "Partner status updated.", data: partner });
  } catch (error) {
    console.error("updatePartnerStatus error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong updating the partner." });
  }
};

const assignTier = async (req, res) => {
  try {
    const { tierId } = req.body;

    const partner = await Partner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({ success: false, message: "Partner not found." });
    }

    partner.program.tierId = tierId || undefined;
    partner.program.tierAssignedAt = new Date();
    partner.program.tierAssignmentMode = "manual";

    await partner.save();

    // Vendor's agreement is deliberately deferred until this point (see
    // updatePartnerStatus) — assigning/confirming a commission rule here,
    // once verified, is what actually generates it. attachPartnerAgreement
    // is idempotent, so reassigning an already-agreed vendor's tier later
    // (e.g. a manual override) is a harmless no-op here, not a reissue.
    if (partner.partnerType === "vendor" && partner.status === "active") {
      await attachPartnerAgreement(partner, req.adminUser._id);
    }

    await logActivity({
      partnerId: partner._id,
      performedByType: "spotx_user",
      performedByUserId: req.adminUser._id,
      activityType: "tier_changed",
      entityType: "Partner",
      entityId: partner._id,
      description: `${req.adminUser.name} assigned a new tier.`,
      req
    });

    return res.json({ success: true, message: "Tier assigned.", data: partner });
  } catch (error) {
    console.error("assignTier error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong assigning the tier." });
  }
};

module.exports = { createPartner, listPartners, getPartner, updatePartnerStatus, assignTier };
