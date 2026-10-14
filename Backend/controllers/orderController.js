const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

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

  const quantities = new Map();
  for (const item of req.body.items) {
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  }
  const reserved = [];
  const snapshots = [];

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
    const order = await Order.create({
      customer: req.user._id,
      items: snapshots,
      totalAmount,
      currency,
      reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    res.status(201).json({ success: true, data: { order } });
  } catch (error) {
    try {
      await rollbackStock(reserved);
    } catch (rollbackError) {
      console.error('Stock rollback failed after order creation error:', rollbackError.message);
      return next(new AppError(500, 'Order creation failed and inventory rollback needs administrator attention.'));
    }
    throw error;
  }
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
