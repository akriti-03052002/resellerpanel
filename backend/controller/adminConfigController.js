const asyncHandler = require("express-async-handler");
const { getMaskedSettings, updateSettings } = require("../utils/paymentGatewayConfig");

/* ============================================================
   ADMIN — PAYMENT GATEWAY
   (Programs admin CRUD, Tiers, Commission Rules and Settlement
   Settings were all removed — Reseller, the only partner type
   left, never earns a commission at all, and program banners are
   no longer editable from admin. Screen Pricing was removed along
   with the legacy customer self-serve subscription flow.)
============================================================ */

// ---- Payment Gateway (Razorpay credentials) ----
// Never returns a decrypted secret — see utils/paymentGatewayConfig for
// exactly what's exposed vs kept write-only.

const getPaymentGatewaySettings = async (req, res) => {
  const settings = await getMaskedSettings();
  return res.json({ success: true, data: settings });
};

const updatePaymentGatewaySettings = asyncHandler(async (req, res) => {
  const { razorpay } = req.body;
  await updateSettings({ razorpay }, req.adminUser._id);
  const settings = await getMaskedSettings();
  return res.json({ success: true, message: "Payment gateway settings saved.", data: settings });
});

module.exports = {
  getPaymentGatewaySettings, updatePaymentGatewaySettings
};
