const { body, param, query } = require('express-validator');

const idParam = [param('id').isMongoId().withMessage('A valid product ID is required.')];
const create = [
  body('name').trim().isLength({ min: 1, max: 160 }).withMessage('Product name is required (maximum 160 characters).'),
  body('description').trim().isLength({ min: 1, max: 10000 }).withMessage('Product description is required.'),
  body('price').isFloat({ gt: 0, decimal_digits: '1,2' }).withMessage('Price must be positive with at most two decimal places.').toFloat(),
  body('category').trim().isLength({ min: 1, max: 100 }).withMessage('Category is required.'),
  body('stockQuantity').isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer.').toInt(),
  body('slug').optional().trim().isLength({ min: 1, max: 180 }).withMessage('Slug must be 1-180 characters.'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean.').toBoolean(),
  body('tags').optional().isArray({ max: 30 }).withMessage('Tags must be an array with at most 30 entries.'),
  body('tags.*').optional().isString().isLength({ max: 50 }).withMessage('Each tag must be a string with at most 50 characters.'),
];
const update = [
  ...idParam,
  body('name').optional().trim().isLength({ min: 1, max: 160 }).withMessage('Product name must be 1-160 characters.'),
  body('description').optional().trim().isLength({ min: 1, max: 10000 }).withMessage('Description must be 1-10000 characters.'),
  body('price').optional().isFloat({ gt: 0, decimal_digits: '1,2' }).withMessage('Price must be positive with at most two decimal places.').toFloat(),
  body('category').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Category must be 1-100 characters.'),
  body('stockQuantity').optional().isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer.').toInt(),
  body('slug').optional().trim().isLength({ min: 1, max: 180 }).withMessage('Slug must be 1-180 characters.'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean.').toBoolean(),
  body('image').not().exists().withMessage('Use the product image upload field to change an image.'),
  body('tags').optional().isArray({ max: 30 }).withMessage('Tags must be an array with at most 30 entries.'),
  body('tags.*').optional().isString().isLength({ max: 50 }).withMessage('Each tag must be a string with at most 50 characters.'),
];
const list = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('minPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('maxPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('inStock').optional().isBoolean().toBoolean(),
];

module.exports = { idParam, create, update, list };
