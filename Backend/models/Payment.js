const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['stripe'], default: 'stripe' },
    providerReference: { type: String, unique: true, sparse: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, lowercase: true },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'expired'], default: 'pending' },
    checkoutUrl: { type: String },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
