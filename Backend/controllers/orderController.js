const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { releaseInventory } = require('../services/inventoryService');
const { getPaymentOption, presentPayment } = require('../services/manualPaymentService');

function rollbackStock(reserved) {
  return reserved.reduce(
    (promise, item) => promise.then(() => Product.updateOne(
      { _id: item.productId },
      { $inc: { stockQuantity: item.quantity } }
    )),
    Promise.resolve()
  );
}

exports.create = asyncHandler(async (req, res, next) => {
  const currency = (process.env.PAYMENT_CURRENCY || 'usd').toLowerCase();
  if (req.body.currency && req.body.currency.toLowerCase() !== currency) {
    return next(new AppError(400, `Orders must use the configured currency (${currency}).`));
  }
  const paymentOption = getPaymentOption(req.body.paymentMethod);
  if (!paymentOption || !paymentOption.enabled) {
    return next(new AppError(503, 'The selected payment option is not configured.'));
  }
  const reservationHours = Number(process.env.PAYMENT_RESERVATION_HOURS || 24);
  if (!Number.isFinite(reservationHours) || reservationHours <= 0) {
    return next(new AppError(500, 'PAYMENT_RESERVATION_HOURS must be a positive number.'));
  }

  const quantities = new Map();
  for (const item of req.body.items) {
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  }
  const reserved = [];
  const snapshots = [];
  let order;
  let payment;

  try {
    for (const [productId, quantity] of quantities) {
      if (!mongoose.isValidObjectId(productId)) throw new AppError(400, 'Invalid product ID.');
      const product = await Product.findOne({ _id: productId, isActive: true });
      if (!product) throw new AppError(400, 'A requested product is unavailable.');
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        throw new AppError(400, 'Combined product quantities must be from 1 to 100.');
      }
      const updated = await Product.findOneAndUpdate(
        { _id: productId, isActive: true, stockQuantity: { $gte: quantity } },
        { $inc: { stockQuantity: -quantity } },
        { returnDocument: 'after' }
      );
      if (!updated) throw new AppError(409, `Insufficient stock for "${product.name}".`);

      reserved.push({ productId, quantity });
      snapshots.push({
        product: product._id,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        subtotal: Math.round(product.price * quantity * 100) / 100,
      });
    }

    const totalAmount = Math.round(
      snapshots.reduce((total, item) => total + item.subtotal, 0) * 100
    ) / 100;
    order = await Order.create({
      customer: req.user._id,
      items: snapshots,
      totalAmount,
      currency,
      paymentMethod: req.body.paymentMethod,
      reservationExpiresAt: req.body.paymentMethod === 'cash_on_delivery'
        ? null
        : new Date(Date.now() + reservationHours * 60 * 60 * 1000),
    });
    payment = await Payment.create({
      order: order._id,
      customer: req.user._id,
      method: req.body.paymentMethod,
      amount: totalAmount,
      currency,
    });
    res.status(201).json({
      success: true,
      data: { order, payment: presentPayment(payment) },
    });
  } catch (error) {
    try {
      if (payment) await Payment.deleteOne({ _id: payment._id });
      if (order) await Order.deleteOne({ _id: order._id });
      await rollbackStock(reserved);
    } catch (rollbackError) {
      console.error('Stock rollback failed after order creation error:', rollbackError.message);
      return next(new AppError(500, 'Order creation failed and inventory rollback needs administrator attention.'));
    }
    throw error;
  }
});

exports.cancel = asyncHandler(async (req, res, next) => {
  const order = await Order.findOne({
    _id: req.params.id,
    customer: req.user._id,
    status: 'pending_payment',
    paymentStatus: 'pending',
  });
  if (!order) return next(new AppError(404, 'Cancelable order not found.'));

  const payment = await Payment.findOne({ order: order._id });
  if (!payment || payment.status !== 'pending') {
    return next(new AppError(409, 'An order with a submitted payment cannot be cancelled online.'));
  }
  const expiredPayment = await Payment.findOneAndUpdate(
    { _id: payment._id, status: 'pending' },
    { $set: { status: 'expired' } },
    { returnDocument: 'after' }
  );
  if (!expiredPayment) return next(new AppError(409, 'The payment has already been submitted or reviewed.'));

  const cancelledOrder = await Order.findOneAndUpdate(
    { _id: order._id, status: 'pending_payment', paymentStatus: 'pending' },
    { $set: { status: 'cancelled', paymentStatus: 'expired' } },
    { returnDocument: 'after' }
  );
  if (!cancelledOrder) {
    await Payment.updateOne(
      { _id: payment._id, status: 'expired' },
      { $set: { status: 'pending' } }
    );
    return next(new AppError(409, 'The order can no longer be cancelled.'));
  }
  await releaseInventory(cancelledOrder);
  res.status(200).json({ success: true, data: { order: cancelledOrder } });
});

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter = req.user.role === 'admin' && req.query.customer
    ? { customer: req.query.customer }
    : req.user.role === 'admin'
      ? {}
      : { customer: req.user._id };
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.status(200).json({
    success: true,
    data: { orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
  });
});

exports.getById = asyncHandler(async (req, res, next) => {
  const filter = { _id: req.params.id };
  if (req.user.role !== 'admin') filter.customer = req.user._id;
  const order = await Order.findOne(filter);
  if (!order) return next(new AppError(404, 'Order not found.'));
  res.status(200).json({ success: true, data: { order } });
});
