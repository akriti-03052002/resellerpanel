const express = require("express");
const router = express.Router();

const {
  createPartner, listPartners, getPartner, updatePartnerStatus,
  getAgreementTerms, updateAgreementTerms, regenerateAgreement
} = require("../controller/adminPartnerController");
const { uploadDocumentForPartner } = require("../controller/adminDocumentController");
const requireAdminRole = require("../middleware/requireAdminRole");
const { uploadDocumentAsAdmin } = require("../middleware/upload");

router.post("/", requireAdminRole("kyc_reviewer"), createPartner);
router.get("/", requireAdminRole("kyc_reviewer", "finance"), listPartners);
router.get("/:id", requireAdminRole("kyc_reviewer", "finance"), getPartner);
router.patch("/:id/status", requireAdminRole("kyc_reviewer"), updatePartnerStatus);
router.post("/:id/documents", requireAdminRole("kyc_reviewer"), uploadDocumentAsAdmin.single("file"), uploadDocumentForPartner);
router.get("/:id/agreement-terms", requireAdminRole("kyc_reviewer"), getAgreementTerms);
router.patch("/:id/agreement-terms", requireAdminRole("kyc_reviewer"), updateAgreementTerms);
router.post("/:id/agreement/regenerate", requireAdminRole("kyc_reviewer"), regenerateAgreement);

module.exports = router;
