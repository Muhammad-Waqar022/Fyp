const express = require('express');
const { body, param } = require('express-validator');
const controller = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
router.post('/webhook', express.raw({ type: 'application/json', limit: '1mb' }), controller.webhook);
router.use(protect);
router.post(
  '/create-checkout-session',
  body('orderId').isMongoId().withMessage('A valid orderId is required.'),
  validate,
  controller.createCheckoutSession
);
router.get('/:id', param('id').isMongoId().withMessage('A valid payment ID is required.'), validate, controller.getPayment);

module.exports = router;
