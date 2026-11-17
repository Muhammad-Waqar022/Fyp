const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    method: {
      type: String,
      enum: ['cash_on_delivery', 'jazzcash', 'easypaisa', 'bank_transfer'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, lowercase: true },
    status: { type: String, enum: ['pending', 'submitted', 'paid', 'rejected', 'expired'], default: 'pending' },
    transactionReference: { type: String, trim: true, maxlength: 120 },
    submittedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
