/**
 * The reseller's customer referral link is displayed repeatedly (admin
 * partner detail, partner profile), unlike a one-time email link — so it
 * must always reflect the CURRENT CLIENT_URL, not whatever CLIENT_URL was
 * set to at the moment the partner was activated. Storing a pre-built link
 * on the Partner doc (as the old code did) goes stale the moment the
 * frontend's deployed URL changes; this recomputes it on every read.
 */
const getReferralLink = (referralCode) =>
  referralCode ? `${process.env.CLIENT_URL || "http://localhost:5173"}/customer/register?ref=${referralCode}` : "";

module.exports = { getReferralLink };
