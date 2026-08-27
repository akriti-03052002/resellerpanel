const { PartnerReferral, PartnerOpportunity } = require("../models/Index");
const logActivity = require("../utils/logActivity");

/* ============================================================
   PARTNER REFERRALS (LEADS)
============================================================ */

const listReferrals = async (req, res) => {
  const referrals = await PartnerReferral.find({ partnerId: req.partner._id }).sort({ createdAt: -1 });

  return res.json({ success: true, data: referrals });
};

const createReferral = async (req, res) => {
  try {
    const { customer, requirement, source } = req.body;

    if (!customer?.companyName) {
      return res.status(400).json({ success: false, message: "Customer company name is required." });
    }

    const referral = await PartnerReferral.create({
      partnerId: req.partner._id,
      referralCode: req.partner.referral?.referralCode || "",
      customer,
      requirement: requirement || {},
      source: source || "partner_portal",
      status: "new"
    });

    await logActivity({
      partnerId: req.partner._id,
      performedByType: "partner_user",
      performedByUserId: req.partnerUser._id,
      activityType: "lead_created",
      entityType: "PartnerReferral",
      entityId: referral._id,
      description: `${req.partnerUser.name} submitted a lead for ${customer.companyName}.`,
      req
    });

    return res.status(201).json({ success: true, message: "Lead submitted.", data: referral });
  } catch (error) {
    console.error("createReferral error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong submitting the lead." });
  }
};

/* Partner converts their own qualified referral into a pipeline opportunity */
const convertReferral = async (req, res) => {
  try {
    const referral = await PartnerReferral.findOne({ _id: req.params.id, partnerId: req.partner._id });

    if (!referral) {
      return res.status(404).json({ success: false, message: "Lead not found." });
    }

    if (["won", "lost", "rejected"].includes(referral.status)) {
      return res.status(400).json({ success: false, message: `Lead is already ${referral.status}.` });
    }

    const opportunity = await PartnerOpportunity.create({
      partnerId: req.partner._id,
      referralId: referral._id,
      customerId: referral.customerId,
      stage: "qualification",
      expectedRevenue: referral.requirement?.estimatedValue || 0,
      expectedScreenCount: referral.requirement?.screenCount || 0
    });

    referral.status = "qualified";
    await referral.save();

    await logActivity({
      partnerId: req.partner._id,
      performedByType: "partner_user",
      performedByUserId: req.partnerUser._id,
      activityType: "note",
      entityType: "PartnerOpportunity",
      entityId: opportunity._id,
      description: `${req.partnerUser.name} converted a lead into an opportunity.`,
      req
    });

    return res.status(201).json({ success: true, message: "Lead converted to opportunity.", data: opportunity });
  } catch (error) {
    console.error("convertReferral error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong converting the lead." });
  }
};

module.exports = { listReferrals, createReferral, convertReferral };
