const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const slugify = require('../utils/slugify');
const { removeUploadedImage } = require('../middleware/upload');

const protectedFields = ['name', 'slug', 'description', 'price', 'category', 'stockQuantity', 'isActive', 'tags'];

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter = req.user && req.user.role === 'admin' ? {} : { isActive: true };

  if (req.query.category) filter.category = String(req.query.category).trim();
  if (req.query.inStock === true || req.query.inStock === 'true') filter.stockQuantity = { $gt: 0 };
  if (req.query.inStock === false || req.query.inStock === 'false') filter.stockQuantity = 0;
  if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
    filter.price = {};
    if (req.query.minPrice !== undefined) filter.price.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice !== undefined) filter.price.$lte = Number(req.query.maxPrice);
  }
  if (req.query.search) {
    const escaped = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.name = { $regex: escaped, $options: 'i' };
  }

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.status(200).json({
    success: true,
    data: { products, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
  });
});

exports.getById = asyncHandler(async (req, res, next) => {
  const filter = { _id: req.params.id };
  if (!(req.user && req.user.role === 'admin')) filter.isActive = true;
  const product = await Product.findOne(filter);
  if (!product) return next(new AppError(404, 'Product not found.'));
  res.status(200).json({ success: true, data: { product } });
});

exports.create = asyncHandler(async (req, res) => {
  const data = {};
  for (const field of protectedFields) {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  }
  data.slug = data.slug ? slugify(data.slug) : slugify(data.name);
  if (req.file) data.image = `/uploads/${req.file.filename}`;
  let product;
  try {
    product = await Product.create(data);
  } catch (error) {
    await removeUploadedImage(req.file);
    throw error;
  }
  res.status(201).json({ success: true, data: { product } });
});

exports.update = asyncHandler(async (req, res, next) => {
  const update = {};
  for (const field of protectedFields) {
    if (req.body[field] !== undefined) update[field] = req.body[field];
  }
  if (update.name && !update.slug) update.slug = slugify(update.name);
  if (update.slug) update.slug = slugify(update.slug);
  if (req.file) update.image = `/uploads/${req.file.filename}`;

  let product;
  try {
    product = await Product.findByIdAndUpdate(req.params.id, update, {
      returnDocument: 'after',
      runValidators: true,
    });
  } catch (error) {
    await removeUploadedImage(req.file);
    throw error;
  }
  if (!product) {
    await removeUploadedImage(req.file);
    return next(new AppError(404, 'Product not found.'));
  }
  res.status(200).json({ success: true, data: { product } });
});

exports.deactivate = asyncHandler(async (req, res, next) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { returnDocument: 'after', runValidators: true }
  );
  if (!product) return next(new AppError(404, 'Product not found.'));
  res.status(200).json({ success: true, data: { product } });
});
