const mongoose = require('mongoose');
const crypto = require('crypto');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      default: () => `ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], required: true, validate: (items) => items.length > 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, lowercase: true, minlength: 3, maxlength: 3 },
    status: {
      type: String,
      enum: ['pending_payment', 'paid', 'cancelled', 'payment_failed', 'expired'],
      default: 'pending_payment',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'expired'],
      default: 'pending',
    },
    inventoryReleased: { type: Boolean, default: false },
    reservationExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 60 * 1000),
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
