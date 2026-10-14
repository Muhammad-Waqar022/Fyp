const express = require('express');
const controller = require('../controllers/productController');
const { allowRoles, protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { uploadProductImage, saveUploadedImage } = require('../middleware/upload');
const validators = require('../validators/productValidators');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { verifyToken } = require('../utils/tokens');

const router = express.Router();
const optionalAuth = asyncHandler(async (req, res, next) => {
  const authorization = req.get('authorization');
  if (!authorization) return next();
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Invalid authorization header.');
  let payload;
  try {
    payload = verifyToken(token, 'access');
  } catch {
    throw new AppError(401, 'Access token is invalid or expired.');
  }
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
    throw new AppError(401, 'This access token is no longer valid.');
  }
  req.user = user;
  next();
});

router.get('/', optionalAuth, validators.list, validate, controller.list);
router.get('/:id', optionalAuth, validators.idParam, validate, controller.getById);
router.post('/', protect, allowRoles('admin'), uploadProductImage, validators.create, validate, saveUploadedImage, controller.create);
router.patch('/:id', protect, allowRoles('admin'), uploadProductImage, validators.update, validate, saveUploadedImage, controller.update);
router.delete('/:id', protect, allowRoles('admin'), validators.idParam, validate, controller.deactivate);

module.exports = router;
