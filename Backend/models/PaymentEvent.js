const mongoose = require('mongoose');

const paymentEventSchema = new mongoose.Schema(
  {
    providerEventId: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentEvent', paymentEventSchema);
