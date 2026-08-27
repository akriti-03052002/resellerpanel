const express = require("express");
const router = express.Router();

const {
  listPrograms, createProgram, updateProgram,
  listTiers, createTier, updateTier,
  listCommissionRules, createCommissionRule, updateCommissionRule,
  listSettlementSettings, upsertSettlementSetting,
  getScreenPricing, updateScreenPricing
} = require("../controller/adminConfigController");
const requireAdminRole = require("../middleware/requireAdminRole");

router.get("/programs", requireAdminRole("kyc_reviewer", "finance"), listPrograms);
router.post("/programs", requireAdminRole(), createProgram);
router.patch("/programs/:id", requireAdminRole(), updateProgram);

router.get("/tiers", requireAdminRole("kyc_reviewer", "finance"), listTiers);
router.post("/tiers", requireAdminRole(), createTier);
router.patch("/tiers/:id", requireAdminRole(), updateTier);

router.get("/commission-rules", requireAdminRole("finance"), listCommissionRules);
router.post("/commission-rules", requireAdminRole("finance"), createCommissionRule);
router.patch("/commission-rules/:id", requireAdminRole("finance"), updateCommissionRule);

router.get("/settlement-settings", requireAdminRole("finance"), listSettlementSettings);
router.put("/settlement-settings", requireAdminRole("finance"), upsertSettlementSetting);

router.get("/screen-pricing", requireAdminRole("finance"), getScreenPricing);
router.put("/screen-pricing", requireAdminRole("finance"), updateScreenPricing);

module.exports = router;
