const { body, param } = require('express-validator');

const create = [
  body('items').isArray({ min: 1, max: 50 }).withMessage('Order must contain between 1 and 50 items.'),
  body('items.*.productId').isMongoId().withMessage('Each item must contain a valid productId.'),
  body('items.*.quantity').isInt({ min: 1, max: 100 }).withMessage('Each quantity must be an integer from 1 to 100.').toInt(),
  body('currency').optional().isIn(['usd', 'eur', 'gbp', 'cad', 'aud', 'pkr']).withMessage('Unsupported order currency.').toLowerCase(),
  body('paymentMethod')
    .isIn(['cash_on_delivery', 'jazzcash', 'easypaisa', 'bank_transfer'])
    .withMessage('Choose cash_on_delivery, jazzcash, easypaisa, or bank_transfer.'),
  body('totalAmount').not().exists().withMessage('Do not send a client-calculated total.'),
  body('price').not().exists().withMessage('Do not send client-supplied prices.'),
];

const idParam = [param('id').isMongoId().withMessage('A valid order ID is required.')];

module.exports = { create, idParam };
