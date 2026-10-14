const mongoose = require('mongoose');
const slugify = require('../utils/slugify');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true, trim: true, maxlength: 10000 },
    price: {
      type: Number,
      required: true,
      min: 0.01,
      validate: {
        validator: (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
        message: 'Price must have at most two decimal places.',
      },
    },
    category: { type: String, required: true, trim: true, maxlength: 100, index: true },
    image: { type: String, default: '' },
    stockQuantity: { type: Number, required: true, min: 0, validate: Number.isInteger },
    isActive: { type: Boolean, default: true, index: true },
    tags: [{ type: String, trim: true }],
    trendScore: { type: Number, min: 0 },
    trendMetadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text', category: 'text' });

productSchema.pre('validate', function setSlug() {
  if (!this.slug && this.name) this.slug = slugify(this.name);
});

module.exports = mongoose.model('Product', productSchema);
