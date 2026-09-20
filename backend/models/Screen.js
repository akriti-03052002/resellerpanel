const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const ObjectId = Schema.Types.ObjectId;

/* ============================================================
   SCREEN
   A physical screen registered against a Reseller's ResellerCustomer
   (see CustomerAllocation) — one row per screen, tracking its license
   lifecycle (registered/active/suspended/cancelled) alongside the
   allocation it was delivered under.
============================================================ */

const ScreenSchema = new Schema(
  {
    customerId: {
      type: ObjectId,
      ref: "ResellerCustomer",
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    location: {
      type: String,
      default: ""
    },

    allocationId: {
      type: ObjectId,
      ref: "CustomerAllocation",
      index: true
    },

    licenseStatus: {
      type: String,
      enum: ["allocated", "registered", "active", "suspended", "cancelled"]
    },

    // True for a screen the Reseller sourced and sold to the customer as
    // part of a bundled screen+software sale. Purely a reference flag — no
    // hardware cost, serial number, make/model, or warranty data is ever
    // tracked here or anywhere else in this system; that side of the
    // business belongs entirely to the Reseller.
    soldAsResellerBundle: {
      type: Boolean,
      default: false
    },

    registeredAt: { type: Date },
    activatedAt: { type: Date },
    suspendedAt: { type: Date },
    cancelledAt: { type: Date }
  },
  {
    timestamps: true
  }
);

module.exports = model("Screen", ScreenSchema);
