const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const asyncHandler = require("express-async-handler");

const { Partner, PartnerUser, PartnerProgram, PartnerNotification, EmailOtp } = require("../models/Index");
const { generatePartnerCode } = require("../utils/generateCode");
const { ROLE_PERMISSIONS } = require("../config/roles");
const logActivity = require("../utils/logActivity");
const { sendMail } = require("../utils/mailer");

// =====================================================
// GENERATE JWT
// =====================================================

const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id, partnerId: user.partnerId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

// =====================================================
// EMAIL OTP — registration email verification
// Two-step: sendEmailOtp emails a 6-digit code and upserts an EmailOtp
// record; verifyEmailOtp checks it and hands back a single-use
// verificationToken. registerPartner requires that token rather than
// trusting a client-side "verified" flag, so the OTP step can't be
// skipped by calling /register directly.
// =====================================================

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_VERIFIED_GRACE_MS = 30 * 60 * 1000; // how long a verified token stays usable for registration
const OTP_MAX_ATTEMPTS = 5;

const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

const sendEmailOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await PartnerUser.findOne({ email: normalizedEmail });

  if (existingUser) {
    return res.status(409).json({ success: false, message: "An account with this email already exists." });
  }

  const otp = String(crypto.randomInt(100000, 1000000));

  await EmailOtp.findOneAndUpdate(
    { email: normalizedEmail },
    {
      email: normalizedEmail,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
      verified: false,
      verificationToken: undefined,
      verifiedAt: undefined
    },
    { upsert: true }
  );

  await sendMail({
    to: normalizedEmail,
    subject: "Your SPOTX Partner verification code",
    text: `Your verification code is ${otp}. It expires in 10 minutes.`,
    html: `
      <p>Your SPOTX Partner verification code is:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${otp}</p>
      <p>This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
    `
  });

  return res.json({ success: true, message: "OTP sent to your email." });
});

const verifyEmailOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const normalizedEmail = email.toLowerCase().trim();
  const record = await EmailOtp.findOne({ email: normalizedEmail });

  if (!record || record.expiresAt < new Date()) {
    return res.status(400).json({ success: false, message: "This OTP has expired. Request a new one." });
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return res.status(429).json({ success: false, message: "Too many incorrect attempts. Request a new OTP." });
  }

  if (record.otpHash !== hashOtp(String(otp).trim())) {
    record.attempts += 1;
    await record.save();
    return res.status(400).json({ success: false, message: "Incorrect OTP." });
  }

  const verificationToken = crypto.randomBytes(24).toString("hex");

  record.verified = true;
  record.verificationToken = verificationToken;
  record.verifiedAt = new Date();
  await record.save();

  return res.json({ success: true, message: "Email verified.", verificationToken });
});

// =====================================================
// REGISTER PARTNER
// =====================================================

const registerPartner = asyncHandler(async (req, res) => {
  const {
    partnerType,
    contactName, email, phone,
    programId,
    password,
    emailVerificationToken
  } = req.body;

  const normalizedEmail = email.toLowerCase().trim();

  const otpRecord = await EmailOtp.findOne({ email: normalizedEmail, verified: true });

  if (
    !otpRecord ||
    !emailVerificationToken ||
    otpRecord.verificationToken !== emailVerificationToken ||
    Date.now() - otpRecord.verifiedAt.getTime() > OTP_VERIFIED_GRACE_MS
  ) {
    return res.status(400).json({ success: false, message: "Please verify your email with the OTP before registering." });
  }

  const existingUser = await PartnerUser.findOne({ email: normalizedEmail });

  if (existingUser) {
    return res.status(409).json({ success: false, message: "An account with this email already exists." });
  }

  let selectedProgram = null;

  if (programId) {
    selectedProgram = await PartnerProgram.findById(programId);

    if (!selectedProgram) {
      return res.status(400).json({ success: false, message: "Invalid partner program." });
    }

    // A program is a limited-time drive, not a permanent category —
    // joining outside its window shouldn't silently grant the incentive.
    if (!selectedProgram.isActiveNow) {
      return res.status(400).json({
        success: false,
        message: "This program is no longer accepting new sign-ups. You can still register normally without it."
      });
    }

    // A program's incentive is scoped to one partner type — applying it
    // to a mismatched type wouldn't make sense.
    if (selectedProgram.type !== partnerType) {
      return res.status(400).json({
        success: false,
        message: `This program is only for ${selectedProgram.type} partners.`
      });
    }
  }

  const partnerCode = generatePartnerCode();

  // Reseller partners don't get their referral code yet — this field
  // means "customer signup code" for a Reseller and is only generated
  // once SPOTX verifies the partner's documents + bank account (see
  // adminPartnerController.updatePartnerStatus / vendorActivation.js).
  const partner = await Partner.create({
    partnerCode,
    partnerType,
    primaryContact: { name: contactName, email: email.toLowerCase().trim(), phone },
    program: selectedProgram ? { programId: selectedProgram._id } : undefined,
    verification: { overallStatus: "not_submitted" },
    status: "draft"
  });

  const passwordHash = await bcrypt.hash(password, 12);

  const partnerUser = await PartnerUser.create({
    partnerId: partner._id,
    name: contactName,
    email: email.toLowerCase().trim(),
    phone: phone || "",
    role: "owner",
    permissions: ROLE_PERMISSIONS.owner,
    auth: { provider: "email", passwordHash },
    status: "active"
  });

  // Single-use — consumed now that registration succeeded.
  await EmailOtp.deleteOne({ email: normalizedEmail });

  await logActivity({
    partnerId: partner._id,
    performedByType: "partner_user",
    performedByUserId: partnerUser._id,
    activityType: "status_changed",
    entityType: "Partner",
    entityId: partner._id,
    description: selectedProgram
      ? `Partner account registered via the "${selectedProgram.name}" program.`
      : "Partner account registered successfully.",
    req
  });

  // A signup bonus isn't tied to a deal, so it doesn't flow through the
  // commission engine — just flag it for an admin to settle manually.
  if (selectedProgram?.incentive?.bonusAmount) {
    const bonusAmount = selectedProgram.incentive.bonusAmount;

    await logActivity({
      partnerId: partner._id,
      performedByType: "system",
      activityType: "note",
      entityType: "Partner",
      entityId: partner._id,
      description: `${bonusAmount} signup bonus earned via "${selectedProgram.name}" — needs manual settlement by an admin.`,
      req
    });

    await PartnerNotification.create({
      partnerId: partner._id,
      type: "signup_bonus",
      title: "Signup bonus earned",
      message: `You earned a ${bonusAmount} signup bonus for joining via "${selectedProgram.name}". SPOTX will settle this shortly.`,
      entity: { type: "PartnerProgram", entityId: selectedProgram._id }
    });
  }

  const token = generateToken(partnerUser);

  return res.status(201).json({
    success: true,
    message: "Partner registration successful.",
    token,
    partner: {
      id: partner._id,
      partnerCode: partner.partnerCode,
      businessName: partner.legalEntity.businessName,
      partnerType: partner.partnerType,
      status: partner.status,
      verificationStatus: partner.verification.overallStatus
    },
    user: { id: partnerUser._id, name: partnerUser.name, email: partnerUser.email, role: partnerUser.role, permissions: partnerUser.permissions },
    joinedProgram: selectedProgram ? { id: selectedProgram._id, name: selectedProgram.name } : null
  });
});

// =====================================================
// LOGIN
// =====================================================

const loginPartner = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await PartnerUser.findOne({ email: email.toLowerCase().trim() }).select("+auth.passwordHash");

  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid email or password." });
  }

  if (user.status === "blocked") {
    return res.status(403).json({ success: false, message: "Your partner account access has been blocked." });
  }

  // Admin-invited accounts start with no password set — the partner sets
  // one via the emailed activation link (createPartner) before they can
  // log in at all.
  if (!user.auth.passwordHash) {
    return res.status(403).json({
      success: false,
      message: "Set your password first using the activation link sent to your email."
    });
  }

  const passwordMatch = await bcrypt.compare(password, user.auth.passwordHash);

  if (!passwordMatch) {
    return res.status(401).json({ success: false, message: "Invalid email or password." });
  }

  user.auth.lastLoginAt = new Date();
  if (user.status === "invited") user.status = "active";
  await user.save();

  const partner = await Partner.findById(user.partnerId);

  if (!partner) {
    return res.status(404).json({ success: false, message: "Partner account not found." });
  }

  await logActivity({
    partnerId: partner._id,
    performedByType: "partner_user",
    performedByUserId: user._id,
    activityType: "login",
    entityType: "PartnerUser",
    entityId: user._id,
    description: "Partner logged into the portal.",
    req
  });

  const token = generateToken(user);

  return res.json({
    success: true,
    message: "Login successful.",
    token,
    partner: {
      id: partner._id,
      partnerCode: partner.partnerCode,
      businessName: partner.legalEntity.businessName,
      partnerType: partner.partnerType,
      status: partner.status,
      verificationStatus: partner.verification.overallStatus
    },
    user: { id: user._id, name: user.name, email: user.email, role: user.role, permissions: user.permissions }
  });
});

// =====================================================
// FORGOT / RESET PASSWORD
// Emailed via Gmail SMTP when SMTP_USER/SMTP_PASS are set in .env;
// falls back to logging the link to the console otherwise.
// =====================================================

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const genericResponse = {
    success: true,
    message: "If an account exists for that email, a reset link has been sent."
  };

  const user = await PartnerUser.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    return res.json(genericResponse);
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  user.auth.resetTokenHash = tokenHash;
  user.auth.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  const resetLink = `${process.env.CLIENT_URL || "http://localhost:5173"}/partner/reset-password/${rawToken}`;

  await sendMail({
    to: user.email,
    subject: "Reset your SPOTX Partner password",
    text: `Reset your password: ${resetLink}\n\nThis link expires in 30 minutes. If you didn't request this, ignore this email.`,
    html: `
      <p>We received a request to reset your SPOTX Partner account password.</p>
      <p><a href="${resetLink}">Reset your password</a></p>
      <p>This link expires in 30 minutes. If you didn't request this, ignore this email.</p>
    `
  });

  return res.json(genericResponse);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await PartnerUser.findOne({
    "auth.resetTokenHash": tokenHash,
    "auth.resetTokenExpires": { $gt: new Date() }
  }).select("+auth.resetTokenHash +auth.resetTokenExpires");

  if (!user) {
    return res.status(400).json({ success: false, message: "This reset link is invalid or has expired." });
  }

  user.auth.passwordHash = await bcrypt.hash(password, 12);
  user.auth.resetTokenHash = undefined;
  user.auth.resetTokenExpires = undefined;
  await user.save();

  return res.json({ success: true, message: "Password reset successful. You can now log in." });
});

module.exports = { registerPartner, loginPartner, forgotPassword, resetPassword, sendEmailOtp, verifyEmailOtp };
