const { PartnerOpportunity } = require("../models/Index");
const logActivity = require("../utils/logActivity");

/* ============================================================
   PARTNER OPPORTUNITIES
   A partner can create one directly (no referralId) or via
   PartnerReferral.convertReferral, which sets referralId.
============================================================ */

const listOpportunities = async (req, res) => {
  const opportunities = await PartnerOpportunity.find({ partnerId: req.partner._id }).sort({ createdAt: -1 });

  return res.json({ success: true, data: opportunities });
};

const createOpportunity = async (req, res) => {
  try {
    const { customerId, expectedRevenue, expectedScreenCount, expectedCloseDate } = req.body;

    const opportunity = await PartnerOpportunity.create({
      partnerId: req.partner._id,
      customerId: customerId || undefined,
      stage: "qualification",
      expectedRevenue: expectedRevenue || 0,
      expectedScreenCount: expectedScreenCount || 0,
      expectedCloseDate: expectedCloseDate || undefined
    });

    await logActivity({
      partnerId: req.partner._id,
      performedByType: "partner_user",
      performedByUserId: req.partnerUser._id,
      activityType: "note",
      entityType: "PartnerOpportunity",
      entityId: opportunity._id,
      description: `${req.partnerUser.name} registered a deal directly.`,
      req
    });

    return res.status(201).json({ success: true, message: "Opportunity created.", data: opportunity });
  } catch (error) {
    console.error("createOpportunity error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong creating the opportunity." });
  }
};

module.exports = { listOpportunities, createOpportunity };
