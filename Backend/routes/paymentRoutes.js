const express = require('express');
const { body, param } = require('express-validator');
const controller = require('../controllers/paymentController');
const { allowRoles, protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
router.get('/options', controller.getOptions);
router.use(protect);
router.post(
  '/:id/submit-reference',
  param('id').isMongoId().withMessage('A valid payment ID is required.'),
  body('transactionReference').trim().isLength({ min: 3, max: 120 })
    .withMessage('Transaction reference must be 3-120 characters.'),
  validate,
  controller.submitReference
);
router.patch(
  '/:id/review',
  allowRoles('admin'),
  param('id').isMongoId().withMessage('A valid payment ID is required.'),
  body('decision').isIn(['confirm', 'reject']).withMessage('Decision must be confirm or reject.'),
  body('note').optional().trim().isLength({ max: 500 }).withMessage('Note cannot exceed 500 characters.'),
  validate,
  controller.reviewPayment
);
router.get('/:id', param('id').isMongoId().withMessage('A valid payment ID is required.'), validate, controller.getPayment);

module.exports = router;
