const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const { startResellerScheduler } = require("./services/resellerScheduler");
const logger = require("./utils/logger");

const partnerAuthMiddleware = require("./middleware/partnerAuthMiddleware");
const loadPartnerContext = require("./middleware/loadPartnerContext");
const requireVerifiedPartner = require("./middleware/requireVerifiedPartner");
const adminAuthMiddleware = require("./middleware/adminAuthMiddleware");
const { handleRazorpayWebhook } = require("./controller/razorpayWebhookController");

const partnerAuthRoutes = require("./router/partnerAuthRoutes");
const partnerProgramPublicRoutes = require("./router/partnerProgramPublicRoutes");
const publicResellerCustomerRoutes = require("./router/publicResellerCustomerRoutes");
const customerPortalRoutes = require("./router/customerPortalRoutes");
const partnerUserRoutes = require("./router/partnerUserRoutes");
const partnerProfileRoutes = require("./router/partnerProfileRoutes");
const partnerDocumentRoutes = require("./router/partnerDocumentRoutes");
const partnerBankRoutes = require("./router/partnerBankRoutes");
const partnerNotificationRoutes = require("./router/partnerNotificationRoutes");
const partnerResellerRoutes = require("./router/partnerResellerRoutes");

const adminAuthRoutes = require("./router/adminAuthRoutes");
const adminPartnerRoutes = require("./router/adminPartnerRoutes");
const adminDocumentRoutes = require("./router/adminDocumentRoutes");
const adminBankRoutes = require("./router/adminBankRoutes");
const adminConfigRoutes = require("./router/adminConfigRoutes");
const adminStatsRoutes = require("./router/adminStatsRoutes");
const adminResellerRoutes = require("./router/adminResellerRoutes");

const app = express();

/* ==========================================
   MIDDLEWARE
========================================== */

app.use(helmet());

const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins
  })
);

// Razorpay webhook: must be mounted with a raw body parser BEFORE the
// global express.json() below — signature verification needs the exact
// raw bytes Razorpay sent, which express.json() would otherwise consume.
app.post("/api/webhooks/razorpay", express.raw({ type: "application/json" }), handleRazorpayWebhook);

app.use(express.json());

// Logs every request to logs/YYYY-MM-DD.log (method, path, status, duration)
// so past traffic is inspectable after the fact, not just in the live console.
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

/* ==========================================
   HEALTH CHECK
========================================== */

app.get("/", (req, res) => {
  res.json({ success: true, message: "SPOTX Partner Panel API running" });
});

/* ==========================================
   PARTNER ROUTES
   /auth is public; everything else requires a
   valid JWT + a fresh PartnerUser/Partner context.
========================================== */

app.use("/api/partner/auth", partnerAuthRoutes);
app.use("/api/partner/programs", partnerProgramPublicRoutes);
app.use("/api/public/reseller-customers", publicResellerCustomerRoutes);
app.use("/api/customer-portal", customerPortalRoutes);

const partnerGuard = [partnerAuthMiddleware, loadPartnerContext];
// Everything a partner needs in order to GET verified stays open; anything
// that presumes verified status (referring, selling, getting paid, adding
// teammates) is locked until then.
const verifiedGuard = [...partnerGuard, requireVerifiedPartner];

app.use("/api/partner/team", verifiedGuard, partnerUserRoutes);
app.use("/api/partner/profile", partnerGuard, partnerProfileRoutes);
app.use("/api/partner/documents", partnerGuard, partnerDocumentRoutes);
app.use("/api/partner/bank", partnerGuard, partnerBankRoutes);
app.use("/api/partner/notifications", partnerGuard, partnerNotificationRoutes);
app.use("/api/partner/reseller", verifiedGuard, partnerResellerRoutes);

/* ==========================================
   ADMIN ROUTES
   /auth is public; everything else requires a
   valid admin JWT (fully separate secret/model).
========================================== */

app.use("/api/admin/auth", adminAuthRoutes);

app.use("/api/admin/partners", adminAuthMiddleware, adminPartnerRoutes);
app.use("/api/admin/documents", adminAuthMiddleware, adminDocumentRoutes);
app.use("/api/admin/bank", adminAuthMiddleware, adminBankRoutes);
app.use("/api/admin/config", adminAuthMiddleware, adminConfigRoutes);
app.use("/api/admin/stats", adminAuthMiddleware, adminStatsRoutes);
app.use("/api/admin/reseller", adminAuthMiddleware, adminResellerRoutes);

/* ==========================================
   404 + ERROR HANDLER
========================================== */

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  logger.error("Unhandled error:", error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Something went wrong.",
    error: process.env.NODE_ENV === "development" ? error.stack : undefined
  });
});

/* ==========================================
   START
========================================== */

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
  startResellerScheduler();
});
