/**
 * Historically seeded placeholder PartnerTier/CommissionRule ladders for
 * the old multi-partner-type model (Vendor, Affiliate, Influencer,
 * Referral). The schema now supports only the Reseller partner type
 * (see backend/config/constant.js PARTNER_TYPES), and Reseller never
 * earns a commission or climbs a tier ladder at all — its pricing lives
 * on ResellerPricingPlan, set per partner by superadmin (see
 * backend/models/ResellerPricingPlan.js) — so there is nothing left for
 * this script to seed.
 *
 * Left in place as a no-op rather than deleted, in case a future
 * Reseller tier/commission ladder is introduced and this is where it
 * would be seeded from.
 */
const run = async () => {
  console.log("Nothing to seed: Reseller has no tier ladder or commission rules.");
  process.exit(0);
};

run();
