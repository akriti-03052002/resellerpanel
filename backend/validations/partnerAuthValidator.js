const { body } = require("express-validator");
const handleValidation = require("./handleValidation");

const sendEmailOtpValidator = [
  body("email")
    .exists({ checkFalsy: true }).withMessage("A valid email is required.")
    .bail()
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).withMessage("A valid email is required."),
  handleValidation
];

const verifyEmailOtpValidator = [
  body("email").exists({ checkFalsy: true }).withMessage("Email and OTP are required."),
  body("otp").exists({ checkFalsy: true }).withMessage("Email and OTP are required."),
  handleValidation
];

const registerPartnerValidator = [
  body("partnerType")
    .custom((value) => value === "reseller")
    .withMessage("Only reseller registration is available. Name, email and phone are required."),
  body("contactName").exists({ checkFalsy: true })
    .withMessage("Only reseller registration is available. Name, email and phone are required."),
  body("email").exists({ checkFalsy: true })
    .withMessage("Only reseller registration is available. Name, email and phone are required."),
  body("phone").exists({ checkFalsy: true })
    .withMessage("Only reseller registration is available. Name, email and phone are required."),
  body("password")
    .exists({ checkFalsy: true }).withMessage("Password is required and must contain at least 8 characters.")
    .bail()
    .isLength({ min: 8 }).withMessage("Password is required and must contain at least 8 characters."),
  handleValidation
];

const loginPartnerValidator = [
  body("email").exists({ checkFalsy: true }).withMessage("Email and password are required."),
  body("password").exists({ checkFalsy: true }).withMessage("Email and password are required."),
  handleValidation
];

const forgotPasswordValidator = [
  body("email").exists({ checkFalsy: true }).withMessage("Email is required."),
  handleValidation
];

const resetPasswordValidator = [
  body("password")
    .exists({ checkFalsy: true }).withMessage("Password must be at least 8 characters.")
    .bail()
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters."),
  handleValidation
];

module.exports = {
  sendEmailOtpValidator,
  verifyEmailOtpValidator,
  registerPartnerValidator,
  loginPartnerValidator,
  forgotPasswordValidator,
  resetPasswordValidator
};
