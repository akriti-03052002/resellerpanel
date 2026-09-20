const asyncHandler = require("express-async-handler");
const ResellerCustomer = require("../models/ResellerCustomer");
const requirePrepaymentDone = require("../utils/requirePrepaymentDone");
const logActivity = require("../utils/logActivity");

/* ============================================================
   PARTNER — RESELLER CUSTOMERS
   A Reseller's own end customers — distinct from Customer.js
   (Vendor's direct SPOTX-billed customer). No resale-price field
   exists anywhere on this or the allocation model — what the
   Reseller charges its customer is out of scope for this platform
   entirely (RESELLER_COMPLETE_PLAN.md B13).
============================================================ */

const listCustomers = asyncHandler(async (req, res) => {
  const customers = await ResellerCustomer.find({ partnerId: req.partner._id }).sort({ createdAt: -1 });
  return res.json({ success: true, data: customers });
});

const getCustomer = asyncHandler(async (req, res) => {
  const customer = await ResellerCustomer.findOne({ _id: req.params.id, partnerId: req.partner._id });
  if (!customer) {
    return res.status(404).json({ success: false, message: "Customer not found." });
  }
  return res.json({ success: true, data: customer });
});

const createCustomer = asyncHandler(async (req, res) => {
  const { companyName, name, email, phone } = req.body;

  if (!companyName) {
    return res.status(400).json({ success: false, message: "Company name is required." });
  }

  const prepaymentGate = await requirePrepaymentDone(req.partner._id);
  if (prepaymentGate) {
    return res.status(prepaymentGate.status).json({ success: false, message: prepaymentGate.message });
  }

  const customer = await ResellerCustomer.create({
    partnerId: req.partner._id,
    businessDetails: { companyName },
    contactDetails: { name: name || "", email: email || "", phone: phone || "" },
    status: "pending"
  });

  await logActivity({
    partnerId: req.partner._id,
    performedByType: "partner_user",
    performedByUserId: req.partnerUser._id,
    activityType: "reseller_customer_created",
    entityType: "ResellerCustomer",
    entityId: customer._id,
    description: `${req.partnerUser.name} added ${companyName} as a customer.`,
    req
  });

  return res.status(201).json({ success: true, message: "Customer added.", data: customer });
});

const updateCustomer = asyncHandler(async (req, res) => {
  const { companyName, name, email, phone } = req.body;

  const customer = await ResellerCustomer.findOne({ _id: req.params.id, partnerId: req.partner._id });
  if (!customer) {
    return res.status(404).json({ success: false, message: "Customer not found." });
  }

  if (companyName !== undefined) {
    if (!companyName.trim()) {
      return res.status(400).json({ success: false, message: "Company name is required." });
    }
    customer.businessDetails.companyName = companyName.trim();
  }

  if (email !== undefined) {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail && normalizedEmail !== customer.contactDetails.email) {
      const existing = await ResellerCustomer.findOne({ "contactDetails.email": normalizedEmail, _id: { $ne: customer._id } });
      if (existing) {
        return res.status(409).json({ success: false, message: "Another customer already uses this email." });
      }
    }
    customer.contactDetails.email = normalizedEmail;
  }

  if (name !== undefined) customer.contactDetails.name = name;
  if (phone !== undefined) customer.contactDetails.phone = phone;

  await customer.save();

  await logActivity({
    partnerId: req.partner._id,
    performedByType: "partner_user",
    performedByUserId: req.partnerUser._id,
    activityType: "note",
    entityType: "ResellerCustomer",
    entityId: customer._id,
    description: `${req.partnerUser.name} updated ${customer.businessDetails.companyName}'s details.`,
    req
  });

  return res.json({ success: true, message: "Customer updated.", data: customer });
});

module.exports = { listCustomers, getCustomer, createCustomer, updateCustomer };
