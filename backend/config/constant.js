/**
 * Shared enum constants used across the Partner Panel schemas.
 * Moved out of models/index.js so they live in one place.
 */

const PARTNER_TYPES = [
  "vendor",
  "influencer",
  "affiliate",
  "referral",
  "agency",
  "reseller",
  "technology",
  "strategic"
];

const PARTNER_STATUS = [
  "draft",
  "pending_verification",
  "under_review",
  "active",
  "suspended",
  "rejected",
  "inactive"
];

const VERIFICATION_STATUS = [
  "not_submitted",
  "pending",
  "verified",
  "rejected",
  "expired"
];

const COMMISSION_TYPES = [
  "percentage",
  "fixed_per_deal",
  "fixed_per_screen",
  "recurring_percentage",
  "recurring_fixed",
  "hybrid",
  // Reseller-specific: not a payout — the discount IS their margin, applied
  // at purchase time. Still logged as a PartnerCommission row for reporting,
  // but settled immediately rather than flowing through approval/payout.
  "wholesale_discount"
];

const SETTLEMENT_TYPES = [
  "monthly",
  "quarterly",
  "threshold",
  "manual"
];

module.exports = {
  PARTNER_TYPES,
  PARTNER_STATUS,
  VERIFICATION_STATUS,
  COMMISSION_TYPES,
  SETTLEMENT_TYPES
};