/* ============================================================
   AUTO TIER ASSIGNMENT
   Historically, the old Vendor partner type climbed a tier ladder
   automatically off its customers' total screen count. The schema now
   supports only the Reseller partner type (see PARTNER_TYPES in
   config/constant.js), and Reseller has no tier ladder or commission
   concept at all — its pricing is set per partner on ResellerPricingPlan
   by superadmin instead (see backend/seed/seedTiers.js). Kept as a no-op
   rather than removed since it's still called from several places
   (adminCustomerController, adminPartnerController, vendorActivation,
   customerPaymentFulfillment) expecting this shape.
============================================================ */

// No-op: Reseller (the only partner type) has no tier ladder to climb.
const autoAssignVendorTier = async () => null;

module.exports = { autoAssignVendorTier };
