const { PartnerDocument, PartnerBankAccount } = require("../models/Index");

/**
 * Which KYC documents are compulsory before a partner can be verified.
 * Reseller is a business entity that invoices SPOTX and moves real
 * commercial volume, so it needs full business KYC. PAN and a cancelled
 * cheque are required as well: PAN is universal in India, and a cheque
 * is how the partner gets paid.
 *
 * This is the one place that decides what's compulsory — Documents.jsx
 * (partner-facing checklist) and this file's isPartnerFullyVerified
 * (the activation gate) both read from it, so they can never disagree.
 */
const REQUIRED_DOCUMENTS_BY_PARTNER_TYPE = {
  reseller: ["msme_udyam", "gst_certificate", "pan_card", "cancelled_cheque"]
};

const getRequiredDocumentTypes = (partnerType) =>
  REQUIRED_DOCUMENTS_BY_PARTNER_TYPE[partnerType] || REQUIRED_DOCUMENTS_BY_PARTNER_TYPE.reseller;

/**
 * Default label for the partner's primary performance metric, used when
 * they don't yet have a tier assigned (PartnerTier.qualification.metric.label
 * is the source of truth once a tier exists — see Partnertier.js).
 */
const DEFAULT_METRIC_LABEL_BY_PARTNER_TYPE = {
  reseller: "Volume Purchased"
};

const getDefaultMetricLabel = (partnerType) =>
  DEFAULT_METRIC_LABEL_BY_PARTNER_TYPE[partnerType] || DEFAULT_METRIC_LABEL_BY_PARTNER_TYPE.reseller;

const isKycDocumentsVerified = async (partnerId, partnerType) => {
  const requiredTypes = getRequiredDocumentTypes(partnerType);

  const documents = await PartnerDocument.find({ partnerId, documentType: { $in: requiredTypes } });

  const verifiedTypes = new Set(
    documents.filter((d) => d.verification.status === "verified").map((d) => d.documentType)
  );

  return requiredTypes.every((type) => verifiedTypes.has(type));
};

const isPartnerFullyVerified = async (partnerId, partnerType) => {
  const [allDocsVerified, bankAccount] = await Promise.all([
    isKycDocumentsVerified(partnerId, partnerType),
    PartnerBankAccount.findOne({ partnerId })
  ]);

  const bankVerified = bankAccount?.verification?.status === "verified";

  return allDocsVerified && bankVerified;
};

module.exports = {
  isPartnerFullyVerified,
  isKycDocumentsVerified,
  getRequiredDocumentTypes,
  REQUIRED_DOCUMENTS_BY_PARTNER_TYPE,
  getDefaultMetricLabel
};
