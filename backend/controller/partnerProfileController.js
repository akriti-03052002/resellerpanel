const asyncHandler = require("express-async-handler");
const { Partner } = require("../models/Index");
const { getRequiredDocumentTypes } = require("../utils/partnerVerification");

/* ============================================================
   PARTNER PROFILE
============================================================ */

const getProfile = async (req, res) => {
  return res.json({
    success: true,
    data: {
      partner: req.partner,
      user: req.partnerUser,
      requiredDocumentTypes: getRequiredDocumentTypes(req.partner.partnerType),
      profileComplete: Boolean(req.partner.legalEntity.businessName)
    }
  });
};

const updateProfile = asyncHandler(async (req, res) => {
  const {
    businessName, legalName, entityType, website, industry,
    contactName, phone, designation,
    country, state, city, addressLine1, addressLine2, pincode
  } = req.body;

  const partner = await Partner.findById(req.partner._id);

  if (businessName) partner.legalEntity.businessName = businessName;
  if (legalName !== undefined) partner.legalEntity.legalName = legalName;
  if (entityType) partner.legalEntity.entityType = entityType;
  if (website !== undefined) partner.legalEntity.website = website;
  if (industry !== undefined) partner.legalEntity.industry = industry;

  if (contactName) partner.primaryContact.name = contactName;
  if (phone !== undefined) partner.primaryContact.phone = phone;
  if (designation !== undefined) partner.primaryContact.designation = designation;

  if (country !== undefined) partner.address.country = country;
  if (state !== undefined) partner.address.state = state;
  if (city !== undefined) partner.address.city = city;
  if (addressLine1 !== undefined) partner.address.addressLine1 = addressLine1;
  if (addressLine2 !== undefined) partner.address.addressLine2 = addressLine2;
  if (pincode !== undefined) partner.address.pincode = pincode;

  await partner.save();

  return res.json({ success: true, message: "Profile updated.", data: partner });
});

module.exports = { getProfile, updateProfile };
