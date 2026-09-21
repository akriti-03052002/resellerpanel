const cloudinary = require("cloudinary").v2;

/* ============================================================
   CLOUDINARY — PARTNER DOCUMENT STORAGE
   Render's filesystem is ephemeral (wiped on every restart/redeploy), so
   uploaded KYC documents and the generated Partner Agreement PDF can't
   live on local disk in production. Cloudinary is the persistent store
   for all of it, uploaded/fetched as "raw" resources (no image
   transformations needed — these are private documents, not display
   images).
============================================================ */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadBuffer = (buffer, { folder, publicId }) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder,
        public_id: publicId,
        use_filename: false,
        unique_filename: false,
        overwrite: false
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });

const deleteFile = (publicId) =>
  cloudinary.uploader.destroy(publicId, { resource_type: "raw" }).catch((error) => {
    // Best-effort cleanup — a failed delete of the OLD file should never
    // fail the request that just successfully created the NEW one.
    console.error("Cloudinary delete failed:", publicId, error.message);
  });

/**
 * Fetches a document's file from Cloudinary and streams it back as a
 * downloadable attachment — never a redirect to the raw Cloudinary URL,
 * so the response always carries our own Content-Disposition/nosniff
 * headers regardless of what the file actually is (see the security
 * review note on serving uploads as attachments from non-executable
 * storage).
 */
const streamAsAttachment = async (res, { url, originalName, mimeType }) => {
  const upstream = await fetch(url);

  if (!upstream.ok || !upstream.body) {
    return res.status(404).json({ success: false, message: "File not found in storage." });
  }

  res.setHeader("Content-Type", mimeType || "application/octet-stream");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `attachment; filename="${(originalName || "document").replace(/"/g, "")}"`);

  const reader = upstream.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
};

module.exports = { cloudinary, uploadBuffer, deleteFile, streamAsAttachment };
