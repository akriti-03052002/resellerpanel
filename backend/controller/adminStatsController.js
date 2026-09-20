const { Partner, PartnerDocument, PartnerBankAccount } = require("../models/Index");

/* ============================================================
   ADMIN — CROSS-CUTTING KPI AGGREGATION
   Read-only rollups for the admin dashboard, sourced entirely
   from existing collections — no new stat fields.
============================================================ */

const groupCounts = (rows) => rows.reduce((acc, r) => ({ ...acc, [r._id || "unknown"]: r.count }), {});

const getKpis = async (req, res) => {
  const [
    totalPartners, activePartners, partnersByType, partnersByStatus,
    documentsByStatus, bankAccountsByStatus
  ] = await Promise.all([
    Partner.countDocuments(),
    Partner.countDocuments({ status: "active" }),
    Partner.aggregate([{ $group: { _id: "$partnerType", count: { $sum: 1 } } }]),
    Partner.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    PartnerDocument.aggregate([{ $group: { _id: "$verification.status", count: { $sum: 1 } } }]),
    PartnerBankAccount.aggregate([{ $group: { _id: "$verification.status", count: { $sum: 1 } } }])
  ]);

  return res.json({
    success: true,
    data: {
      totalPartners,
      activePartners,
      partnersByType: groupCounts(partnersByType),
      partnersByStatus: groupCounts(partnersByStatus),
      documentsByStatus: groupCounts(documentsByStatus),
      bankAccountsByStatus: groupCounts(bankAccountsByStatus)
    }
  });
};

module.exports = { getKpis };
