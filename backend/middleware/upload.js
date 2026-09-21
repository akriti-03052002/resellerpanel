const multer = require("multer");

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg"
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Buffered in memory, not written to local disk — the controller uploads
// the buffer straight to Cloudinary (see utils/cloudinary.js). Render's
// filesystem is ephemeral, so anything saved to disk here would vanish on
// the next restart/redeploy.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Only PDF, PNG and JPG files are allowed."));
  }

  cb(null, true);
};

const uploadDocument = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

// Same rules, but for an admin uploading on a partner's behalf (e.g. when
// onboarding one directly) — there's no req.partner in that request, only
// the partnerId in the route params.
const uploadDocumentAsAdmin = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

module.exports = { uploadDocument, uploadDocumentAsAdmin };
