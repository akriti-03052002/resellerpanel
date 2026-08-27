const { PartnerSettlement, PartnerCommission, SettlementSetting, Partner, PartnerNotification } = require("../models/Index");
const { generateSettlementNumber } = require("../utils/generateCode");
const logActivity = require("../utils/logActivity");

/* ============================================================
   ADMIN — SETTLEMENT / PAYOUT BATCHES
============================================================ */

const listSettlements = async (req, res) => {
  const { status, partnerId } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (partnerId) filter.partnerId = partnerId;

  const settlements = await PartnerSettlement.find(filter)
    .sort({ createdAt: -1 })
    .populate("partnerId", "partnerCode legalEntity.businessName");

  return res.json({ success: true, data: settlements });
};

/* Bundles a partner's approved commissions into a draft settlement batch */
const createSettlement = async (req, res) => {
  try {
    const { partnerId, commissionIds, periodFrom, periodTo } = req.body;

    if (!partnerId || !Array.isArray(commissionIds) || commissionIds.length === 0) {
      return res.status(400).json({ success: false, message: "partnerId and at least one commissionId are required." });
    }

    const commissions = await PartnerCommission.find({
      _id: { $in: commissionIds },
      partnerId,
      "settlement.status": "approved"
    });

    if (commissions.length === 0) {
      return res.status(400).json({ success: false, message: "No approved commissions found for this selection." });
    }

    const gross = commissions.reduce((sum, c) => sum + c.calculation.netCommission, 0);

    const settlementSetting = await SettlementSetting.findOne({ partnerId });
    const tdsRate = settlementSetting?.tax?.tdsEnabled ? settlementSetting.tax.tdsRate : 0;
    const tdsAmount = (gross * tdsRate) / 100;
    const net = gross - tdsAmount;

    const settlement = await PartnerSettlement.create({
      settlementNumber: generateSettlementNumber(),
      partnerId,
      commissionIds: commissions.map((c) => c._id),
      period: { from: periodFrom || undefined, to: periodTo || undefined },
      settlementType: settlementSetting?.settlementType || "manual",
      amount: { gross, deductions: tdsAmount, net, currency: "INR" },
      tax: { tdsRate, tdsAmount },
      status: "draft"
    });

    await PartnerCommission.updateMany(
      { _id: { $in: commissions.map((c) => c._id) } },
      { $set: { "settlement.status": "eligible", "settlement.settlementId": settlement._id } }
    );

    await logActivity({
      partnerId,
      performedByType: "spotx_user",
      performedByUserId: req.adminUser._id,
      activityType: "settlement_created",
      entityType: "PartnerSettlement",
      entityId: settlement._id,
      description: `${req.adminUser.name} created a settlement batch of ${net.toFixed(2)}.`,
      req
    });

    return res.status(201).json({ success: true, message: "Settlement batch created.", data: settlement });
  } catch (error) {
    console.error("createSettlement error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong creating the settlement." });
  }
};

const approveSettlement = async (req, res) => {
  const settlement = await PartnerSettlement.findById(req.params.id);

  if (!settlement) {
    return res.status(404).json({ success: false, message: "Settlement not found." });
  }

  if (!["draft", "pending_approval"].includes(settlement.status)) {
    return res.status(400).json({ success: false, message: `Settlement is already ${settlement.status}.` });
  }

  settlement.status = "approved";
  settlement.approvedBy = req.adminUser._id;
  settlement.approvedAt = new Date();
  await settlement.save();

  return res.json({ success: true, message: "Settlement approved.", data: settlement });
};

const markSettlementPaid = async (req, res) => {
  try {
    const { method, transactionId } = req.body;

    const settlement = await PartnerSettlement.findById(req.params.id);

    if (!settlement) {
      return res.status(404).json({ success: false, message: "Settlement not found." });
    }

    if (settlement.status !== "approved") {
      return res.status(400).json({ success: false, message: "Only an approved settlement can be marked paid." });
    }

    settlement.status = "paid";
    settlement.payment = { method: method || "bank_transfer", transactionId: transactionId || "", paidAt: new Date() };
    await settlement.save();

    await PartnerCommission.updateMany(
      { _id: { $in: settlement.commissionIds } },
      { $set: { "settlement.status": "settled" } }
    );

    const partner = await Partner.findById(settlement.partnerId);
    partner.stats.paidCommission += settlement.amount.net;
    partner.stats.pendingCommission = Math.max(0, partner.stats.pendingCommission - settlement.amount.net);
    await partner.save();

    await logActivity({
      partnerId: settlement.partnerId,
      performedByType: "spotx_user",
      performedByUserId: req.adminUser._id,
      activityType: "settlement_paid",
      entityType: "PartnerSettlement",
      entityId: settlement._id,
      description: `${req.adminUser.name} marked the settlement as paid.`,
      req
    });

    await PartnerNotification.create({
      partnerId: settlement.partnerId,
      type: "settlement_paid",
      title: "Payout completed",
      message: `Your settlement of ${settlement.amount.net.toFixed(2)} has been paid.`,
      entity: { type: "PartnerSettlement", entityId: settlement._id }
    });

    return res.json({ success: true, message: "Settlement marked paid.", data: settlement });
  } catch (error) {
    console.error("markSettlementPaid error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong marking the settlement paid." });
  }
};

module.exports = { listSettlements, createSettlement, approveSettlement, markSettlementPaid };
