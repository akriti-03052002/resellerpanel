const express = require("express");
const router = express.Router();

const {
  listSettlements, createSettlement, approveSettlement, markSettlementPaid
} = require("../controller/adminSettlementController");
const requireAdminRole = require("../middleware/requireAdminRole");

router.get("/", requireAdminRole("finance"), listSettlements);
router.post("/", requireAdminRole("finance"), createSettlement);
router.patch("/:id/approve", requireAdminRole("finance"), approveSettlement);
router.patch("/:id/mark-paid", requireAdminRole("finance"), markSettlementPaid);

module.exports = router;
