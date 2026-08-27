const express = require("express");
const router = express.Router();

const { getProfile, updateProfile, changePassword, listInvoices } = require("../controller/customerController");
const { listScreens, createScreen, deleteScreen } = require("../controller/customerScreenController");
const { getSubscription, subscribeToPlan } = require("../controller/customerSubscriptionController");

router.get("/profile", getProfile);
router.patch("/profile", updateProfile);
router.post("/change-password", changePassword);
router.get("/invoices", listInvoices);

router.get("/screens", listScreens);
router.post("/screens", createScreen);
router.delete("/screens/:id", deleteScreen);

router.get("/subscription", getSubscription);
router.post("/subscription/subscribe", subscribeToPlan);

module.exports = router;
