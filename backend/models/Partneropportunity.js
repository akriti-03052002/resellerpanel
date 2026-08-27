const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const ObjectId = Schema.Types.ObjectId;

/* ============================================================
   PARTNER OPPORTUNITY
============================================================ */

const PartnerOpportunitySchema = new Schema(
  {
    partnerId: {
      type: ObjectId,
      ref: "Partner",
      required: true,
      index: true
    },

    /* OPTIONAL — an opportunity can be created directly by a partner
       without going through the PartnerReferral lead stage first */
    referralId: {
      type: ObjectId,
      ref: "PartnerReferral",
      index: true
    },

    customerId: {
      type: ObjectId,
      ref: "Customer"
    },

    /* SALES PIPELINE */
    stage: {
      type: String,
      enum: ["qualification", "demo", "proposal", "negotiation", "won", "lost"],
      default: "qualification",
      index: true
    },

    expectedRevenue: {
      type: Number,
      default: 0
    },

    expectedScreenCount: {
      type: Number,
      default: 0
    },

    probability: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },

    expectedCloseDate: {
      type: Date
    },

    /* DEMO */
    demo: {
      scheduledAt: Date,
      completedAt: Date,
      status: {
        type: String,
        enum: ["not_scheduled", "scheduled", "completed", "cancelled"],
        default: "not_scheduled"
      }
    },

    /* PROPOSAL */
    proposal: {
      amount: Number,
      sentAt: Date
    },

    /* RESULT */
    result: {
      status: {
        type: String,
        enum: ["open", "won", "lost"],
        default: "open"
      },
      lostReason: String,
      wonAt: Date
    },

    salesOwner: {
      type: ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true
  }
);

module.exports = model("PartnerOpportunity", PartnerOpportunitySchema);