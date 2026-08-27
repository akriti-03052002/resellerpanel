const express = require("express");
const router = express.Router();

const { listSettlements, getSettlementDetail } = require("../controller/partnerSettlementController");
const requirePermission = require("../middleware/requirePermission");

router.get("/", requirePermission("settlements:view"), listSettlements);
router.get("/:id", requirePermission("settlements:view"), getSettlementDetail);

module.exports = router;
