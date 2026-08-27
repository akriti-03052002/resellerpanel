const express = require("express");
const router = express.Router();

const { getBankAccount, upsertBankAccount } = require("../controller/partnerBankController");
const requirePermission = require("../middleware/requirePermission");

router.get("/", requirePermission("bank:view"), getBankAccount);
router.put("/", requirePermission("bank:manage"), upsertBankAccount);

module.exports = router;
