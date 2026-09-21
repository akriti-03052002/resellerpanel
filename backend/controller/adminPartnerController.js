const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");

const { Partner, PartnerDocument, PartnerBankAccount, PartnerUser, PartnerNotification } = require("../models/Index");
const { generatePartnerCode } = require("../utils/generateCode");
const { ROLE_PERMISSIONS } = require("../config/roles");
const logActivity = require("../utils/logActivity");
const { assignReferralCode } = require("../services/vendorActivation");
const { attachPartnerAgreement, generatePartnerAgreementFile, AGREEMENT_SECTIONS, resolveSectionText } = require("../services/generatePartnerAgreement");
const { getRequiredDocumentTypes, isPartnerFullyVerified } = require("../utils/partnerVerification");
const { sendMail } = require("../utils/mailer");

/* ============================================================
   ADMIN — PARTNER MANAGEMENT
============================================================ */

// Method 2 from the spec: an admin onboards a partner on their behalf
// (no self-registration) — same minimal fields as partnerAuthController.
// registerPartner (type, name, email, phone) minus the promo-program join
// step (that's a self-service concept). Unlike a customer invite, the admin
// types the partner's login password directly here rather than the partner
// picking their own via a set-password link — the plaintext password is
// emailed to them once below (the only place it's ever available, before
// it's hashed), and they can change it any time afterwards via the
// existing forgot/reset password flow. Business name, legal details,
// address, KYC docs and bank all get filled in later from the partner's
// own Profile page.
const createPartner = asyncHandler(async (req, res) => {
  const { partnerType, contactName, email, phone, password } = req.body;

  if (partnerType !== "reseller" || !contactName || !email || !phone || !password) {
    return res.status(400).json({
        success: false,
        message: "Only reseller partners can be created. Name, email, phone and password are required."
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

  const partner = await Partner.create({
      partnerCode,
      partnerType,
      primaryContact: { name: contactName, email: email.toLowerCase().trim(), phone },
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

  const loginUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/partner/login`;

  // The password is only ever available here, in plaintext, before it's
  // hashed above — this is the one place it can be handed to the partner.
  // They can change it any time afterwards via the existing forgot/reset
  // password flow (partnerAuthController.forgotPassword/resetPassword).
  await sendMail({
      to: partnerUser.email,
      subject: "You've been added as a SPOTX Partner",
      text: `${req.adminUser.name} created a SPOTX Partner account for you.\n\nLogin email: ${partnerUser.email}\nPassword: ${password}\n\nLog in here: ${loginUrl}\n\nYou can change this password any time from the login page's "Forgot password" link.`,
      html: `
      <p>${req.adminUser.name} created a SPOTX Partner account for you.</p>
      <p><strong>Login email:</strong> ${partnerUser.email}<br/>
      <strong>Password:</strong> ${password}</p>
      <p><a href="${loginUrl}">Log in to SPOTX Partner Panel</a></p>
      <p>You can change this password any time from the login page's "Forgot password" link.</p>
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
});

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
            verification: bankAccount.verification,
            razorpayCheck: bankAccount.razorpayCheck
          }
        : null,
      team
    }
  });
};

const updatePartnerStatus = asyncHandler(async (req, res) => {
  const { status, rejectionReason } = req.body;
  const validStatuses = ["draft", "pending_verification", "under_review", "active", "suspended", "rejected", "inactive"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status." });
  }

  const partner = await Partner.findById(req.params.id);

  if (!partner) {
    return res.status(404).json({ success: false, message: "Partner not found." });
  }

  // A partner is never "active" without both KYC docs and their bank
  // account actually verified — this is the same gate the automatic
  // activation path (vendorActivation.autoActivatePartnerIfVerified)
  // enforces. An admin picking "active" from this dropdown is a manual
  // override of the STATUS workflow, not a bypass of that verification
  // requirement.
  if (status === "active") {
    const fullyVerified = await isPartnerFullyVerified(partner._id, partner.partnerType);
    if (!fullyVerified) {
      return res.status(400).json({
          success: false,
          message: "This partner can't be marked active yet — their KYC documents and bank account must both be verified first."
        });
    }
  }

  partner.status = status;

  let generatedReferralCode = null;

  if (status === "active") {
    partner.verification.overallStatus = "verified";
    partner.verification.verifiedBy = req.adminUser._id;
    partner.verification.verifiedAt = new Date();

    // Reseller's customer-signup code — normally auto-generated the moment
    // documents + bank verification both complete (see
    // autoActivatePartnerIfVerified). This is the manual-override path:
    // an admin activating a partner by hand still gets one too.
    if (partner.partnerType === "reseller" && !partner.referral?.referralCode) {
      generatedReferralCode = await assignReferralCode(partner);
    }
  }

  if (status === "rejected") {
    partner.verification.overallStatus = "rejected";
    partner.verification.rejectionReason = rejectionReason || "";
  }

  await partner.save();

  // Reseller has no tier ladder or commission to wait on — the agreement
  // is generated immediately on activation.
  if (status === "active") {
    await attachPartnerAgreement(partner, req.adminUser._id);
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
});

// Each reseller can be on different negotiated terms — this returns every
// editable section of the agreement (see AGREEMENT_SECTIONS in
// generatePartnerAgreement.js) with the text that would render for this
// partner right now: their saved override if they have one, otherwise the
// standard template default.
const getAgreementTerms = asyncHandler(async (req, res) => {
  const partner = await Partner.findById(req.params.id);

  if (!partner) {
    return res.status(404).json({ success: false, message: "Partner not found." });
  }

  const sections = AGREEMENT_SECTIONS.map((section) => ({
      key: section.key,
      title: section.title,
      value: resolveSectionText(partner, section),
      isCustomized: Boolean(partner.agreementTerms?.[section.key]?.trim?.())
    }));

  return res.json({ success: true, data: { sections } });
});

// Saves per-partner overrides only — doesn't touch any agreement PDF
// already on file. If the partner already has a generated agreement, an
// admin needs to call regenerateAgreement separately to reissue it with
// this new text (see that endpoint's comment for why this isn't automatic).
const updateAgreementTerms = asyncHandler(async (req, res) => {
  const { sections } = req.body;

  const partner = await Partner.findById(req.params.id);

  if (!partner) {
    return res.status(404).json({ success: false, message: "Partner not found." });
  }

  const validKeys = new Set(AGREEMENT_SECTIONS.map((s) => s.key));
  const next = { ...(partner.agreementTerms || {}) };

  for (const [key, value] of Object.entries(sections || {})) {
    if (!validKeys.has(key) || typeof value !== "string") continue;
    next[key] = value;
  }

  partner.agreementTerms = next;
  partner.markModified("agreementTerms");
  await partner.save();

  await logActivity({
      partnerId: partner._id,
      performedByType: "spotx_user",
      performedByUserId: req.adminUser._id,
      activityType: "agreement_terms_updated",
      entityType: "Partner",
      entityId: partner._id,
      description: `${req.adminUser.name} updated this partner's agreement terms.`,
      req
    });

  return res.json({ success: true, message: "Agreement terms saved." });
});

// Reissues the agreement PDF from the partner's current terms (including
// any overrides just saved). Not automatic on save — the agreement is a
// legal document already in the partner's document list, so re-generating
// it is a deliberate admin action, not a side effect of editing a draft.
// The prior version is superseded (marked rejected, not deleted) so the
// document history stays intact.
const regenerateAgreement = asyncHandler(async (req, res) => {
  const partner = await Partner.findById(req.params.id);

  if (!partner) {
    return res.status(404).json({ success: false, message: "Partner not found." });
  }

  const existing = await PartnerDocument.findOne({ partnerId: partner._id, documentType: "partner_agreement" });

  if (existing) {
    existing.verification.status = "rejected";
    existing.verification.rejectionReason = "Superseded by a reissued agreement.";
    await existing.save();
  }

  const file = await generatePartnerAgreementFile(partner);

  const document = await PartnerDocument.create({
      partnerId: partner._id,
      documentType: "partner_agreement",
      file,
      verification: {
        status: "verified",
        verifiedBy: req.adminUser._id,
        verifiedAt: new Date()
      }
    });

  await logActivity({
      partnerId: partner._id,
      performedByType: "spotx_user",
      performedByUserId: req.adminUser._id,
      activityType: "agreement_regenerated",
      entityType: "Partner",
      entityId: partner._id,
      description: `${req.adminUser.name} reissued this partner's agreement.`,
      req
    });

  return res.json({ success: true, message: "Agreement reissued.", data: document });
});

module.exports = {
  createPartner, listPartners, getPartner, updatePartnerStatus,
  getAgreementTerms, updateAgreementTerms, regenerateAgreement
};
