const Order = require('../models/Order');
const Payment = require('../models/Payment');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { releaseInventory } = require('../services/inventoryService');
const {
  getPaymentOption,
  getPaymentOptions,
  presentPayment,
} = require('../services/manualPaymentService');

exports.getOptions = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { options: getPaymentOptions() } });
});

exports.submitReference = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findOneAndUpdate(
    {
      _id: req.params.id,
      customer: req.user._id,
      method: { $in: ['jazzcash', 'easypaisa', 'bank_transfer'] },
      status: 'pending',
    },
    {
      $set: {
        status: 'submitted',
        transactionReference: req.body.transactionReference,
        submittedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );
  if (!payment) {
    return next(new AppError(409, 'Payment is not available for reference submission.'));
  }
  res.status(200).json({
    success: true,
    data: { payment: presentPayment(payment) },
  });
});

exports.reviewPayment = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) return next(new AppError(404, 'Payment not found.'));

  const canReviewCod = payment.method === 'cash_on_delivery' && payment.status === 'pending';
  const canReviewTransfer = (
    ['jazzcash', 'easypaisa', 'bank_transfer'].includes(payment.method) &&
    payment.status === 'submitted'
  );
  if (!canReviewCod && !canReviewTransfer) {
    return next(new AppError(409, 'This payment is not awaiting administrator review.'));
  }

  const previousStatus = payment.status;
  const confirmed = req.body.decision === 'confirm';
  const updatedOrder = await Order.findOneAndUpdate(
    { _id: payment.order, status: 'pending_payment', paymentStatus: 'pending' },
    {
      $set: confirmed
        ? { status: 'paid', paymentStatus: 'paid' }
        : { status: 'payment_failed', paymentStatus: 'failed' },
    },
    { returnDocument: 'after' }
  );
  if (!updatedOrder) {
    return next(new AppError(409, 'The order is no longer awaiting payment.'));
  }

  const updatedPayment = await Payment.findOneAndUpdate(
    { _id: payment._id, status: previousStatus },
    {
      $set: {
        status: confirmed ? 'paid' : 'rejected',
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
        reviewNote: req.body.note || '',
      },
    },
    { returnDocument: 'after' }
  );
  if (!updatedPayment) {
    const restoredOrder = await Order.findOneAndUpdate(
      { _id: updatedOrder._id, status: confirmed ? 'paid' : 'payment_failed' },
      { $set: { status: 'pending_payment', paymentStatus: 'pending' } }
    );
    if (!restoredOrder) {
      throw new AppError(500, 'Payment review conflicted with an order update and needs administrator attention.');
    }
    return next(new AppError(409, 'This payment has already been reviewed.'));
  }

  if (!confirmed) await releaseInventory(updatedOrder);
  res.status(200).json({
    success: true,
    data: { payment: presentPayment(updatedPayment), order: updatedOrder },
  });
});

exports.getPayment = asyncHandler(async (req, res, next) => {
  const filter = { _id: req.params.id };
  if (req.user.role !== 'admin') filter.customer = req.user._id;
  const payment = await Payment.findOne(filter);
  if (!payment) return next(new AppError(404, 'Payment not found.'));
  res.status(200).json({
    success: true,
    data: { payment: presentPayment(payment) },
  });
});
