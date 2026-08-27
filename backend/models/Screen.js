const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const ObjectId = Schema.Types.ObjectId;

/* ============================================================
   SCREEN
   A physical screen a customer has registered. The customer's
   registered screen count (shown as the default on the
   Subscription page) is just a count of these per customerId.
============================================================ */

const ScreenSchema = new Schema(
  {
    customerId: {
      type: ObjectId,
      ref: "Customer",
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
    }
  },
  {
    timestamps: true
  }
);

module.exports = model("Screen", ScreenSchema);
