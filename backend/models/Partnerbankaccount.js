const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const { VERIFICATION_STATUS } = require("../config/constant");

/* ============================================================
   SECURE PARTNER BANK DETAILS
   VERY IMPORTANT:
   This collection should have restricted application access.
   accountNumberEncrypted and ifscEncrypted should be encrypted
   BEFORE they reach MongoDB.
   Partner users should NOT be allowed to query this collection
   directly.
============================================================ */

const PartnerBankAccountSchema = new Schema(
  {
    partnerId: {
      type: ObjectId,
      ref: "Partner",
      required: true,
      unique: true,
      index: true
    },

    accountHolderName: {
      type: String,
      required: true
    },

    bankName: {
      type: String,
      required: true
    },

    /* SENSITIVE */
    accountNumberEncrypted: {
      type: String,
      required: true,
      select: false
    },

    accountNumberLast4: {
      type: String,
      required: true
    },

    ifscEncrypted: {
      type: String,
      required: true,
      select: false
    },

    ifscMasked: {
      type: String,
      default: ""
    },

    accountType: {
      type: String,
      enum: ["current", "savings", "other"],
      required: true
    },

    /* CANCELLED CHEQUE */
    cancelledChequeDocumentId: {
      type: ObjectId,
      ref: "PartnerDocument"
    },

    /* VERIFICATION */
    verification: {
      status: {
        type: String,
        enum: VERIFICATION_STATUS,
        default: "pending"
      },

      verifiedBy: {
        type: ObjectId,
        ref: "User"
      },

      verifiedAt: {
        type: Date
      },

      rejectionReason: {
        type: String,
        default: ""
      }
    },

    /* SECURITY AUDIT */
    security: {
      encryptedAt: {
        type: Date
      },

      keyVersion: {
        type: String
      },

      lastAccessedAt: {
        type: Date
      },

      lastAccessedBy: {
        type: ObjectId,
        ref: "User"
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports = model("PartnerBankAccount", PartnerBankAccountSchema);