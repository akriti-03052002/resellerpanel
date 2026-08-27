const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const { SETTLEMENT_TYPES } = require("../config/constant");

/* ============================================================
   PARTNER SETTLEMENT / PAYOUT
============================================================ */

const PartnerSettlementSchema = new Schema(
  {
    settlementNumber: {
      type: String,
      unique: true,
      index: true
    },

    partnerId: {
      type: ObjectId,
      ref: "Partner",
      required: true,
      index: true
    },

    /* COMMISSIONS INCLUDED */
    commissionIds: [
      {
        type: ObjectId,
        ref: "PartnerCommission"
      }
    ],

    /* SETTLEMENT PERIOD */
    period: {
      from: Date,
      to: Date
    },

    settlementType: {
      type: String,
      enum: SETTLEMENT_TYPES,
      required: true
    },

    /* MONEY */
    amount: {
      gross: { type: Number, default: 0 },
      deductions: { type: Number, default: 0 },
      net: { type: Number, default: 0 },
      currency: { type: String, default: "INR" }
    },

    /* TAX */
    tax: {
      tdsRate: { type: Number, default: 0 },
      tdsAmount: { type: Number, default: 0 }
    },

    /* PAYMENT */
    payment: {
      method: {
        type: String,
        enum: ["bank_transfer", "upi", "other"]
      },
      transactionId: { type: String, default: "" },
      paidAt: Date
    },

    /* SETTLEMENT STATUS */
    status: {
      type: String,
      enum: [
        "draft",
        "pending_approval",
        "approved",
        "processing",
        "paid",
        "failed",
        "cancelled"
      ],
      default: "draft",
      index: true
    },

    // if approvedBy is empty, treat as system-approved
    approvedBy: {
      type: ObjectId,
      ref: "User"
    },

    approvedAt: Date,

    failureReason: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = model("PartnerSettlement", PartnerSettlementSchema);