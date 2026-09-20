/**
 * Shared enum constants used across the Partner Panel schemas.
 * Moved out of models/index.js so they live in one place.
 */

const PARTNER_TYPES = ["reseller"];

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

// Reseller-only: which side of the license-purchase-vs-pricing rate a
// Reseller partner is on, set per partner by superadmin from their signed
// agreement — see backend/models/ResellerPricingPlan.js.
const RESELLER_PRICING_MODES = ["discount_percent", "fixed_price"];

// Reseller-only: how often SPOTX bills a Reseller partner for their total
// purchased licenses (never based on usage) — set per partner's agreement.
const RESELLER_BILLING_CYCLES = ["monthly", "quarterly", "yearly"];

module.exports = {
  PARTNER_TYPES,
  PARTNER_STATUS,
  VERIFICATION_STATUS,
  RESELLER_PRICING_MODES,
  RESELLER_BILLING_CYCLES
};