const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const validators = require('../validators/authValidators');
const { body } = require('express-validator');

const router = express.Router();
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', sensitiveLimiter, validators.register, validate, controller.register);
router.post('/login', sensitiveLimiter, validators.login, validate, controller.login);
router.post('/refresh', sensitiveLimiter, controller.refresh);
router.post('/logout', protect, controller.logout);
router.get('/profile', protect, controller.getProfile);
router.patch('/profile', protect, validators.profile, validate, controller.updateProfile);
router.post(
  '/change-password',
  protect,
  body('currentPassword').isString().notEmpty().withMessage('Current password is required.'),
  body('newPassword').isString().notEmpty().withMessage('New password is required.'),
  validate,
  controller.changePassword
);
router.post(
  '/password-reset',
  sensitiveLimiter,
  body('email').isEmail().withMessage('A valid email address is required.').normalizeEmail(),
  validate,
  controller.requestPasswordReset
);
router.post(
  '/password-reset/confirm',
  sensitiveLimiter,
  body('token').isString().notEmpty().withMessage('Reset token is required.'),
  body('newPassword').isString().notEmpty().withMessage('New password is required.'),
  validate,
  controller.resetPassword
);

module.exports = router;
