const Order = require('../models/Order');
const Payment = require('../models/Payment');
const PaymentEvent = require('../models/PaymentEvent');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const stripeService = require('../services/stripeService');
const { releaseInventory } = require('../services/inventoryService');

exports.createCheckoutSession = asyncHandler(async (req, res, next) => {
  const order = await Order.findOne({
    _id: req.body.orderId,
    customer: req.user._id,
    status: 'pending_payment',
    paymentStatus: 'pending',
    reservationExpiresAt: { $gt: new Date() },
  });
  if (!order) return next(new AppError(404, 'Pending order not found for this customer.'));

  const existingPayment = await Payment.findOne({ order: order._id });
  if (existingPayment && existingPayment.checkoutUrl) {
    if (existingPayment.expiresAt > new Date()) {
      return res.status(200).json({
        success: true,
        data: {
          paymentId: existingPayment.id,
          checkoutUrl: existingPayment.checkoutUrl,
          expiresAt: existingPayment.expiresAt,
        },
      });
    }
    return next(new AppError(409, 'A checkout session was already created for this order. Create a new order if it has expired.'));
  }

  const stripe = stripeService.getStripeClient();
  order.reservationExpiresAt = new Date(Date.now() + 31 * 60 * 1000);
  await order.save();
  const payment = existingPayment || await Payment.create({
    order: order._id,
    customer: req.user._id,
    amount: order.totalAmount,
    currency: order.currency,
  });
  const baseUrl = process.env.PAYMENT_RETURN_URL || process.env.CLIENT_URL || 'http://localhost:3000';
  let session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: order.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: order.currency,
            unit_amount: Math.round(item.unitPrice * 100),
            product_data: { name: item.productName },
          },
        })),
        success_url: `${baseUrl.replace(/\/$/, '')}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl.replace(/\/$/, '')}/payment/cancel?order_id=${order.id}`,
        client_reference_id: order.id,
        metadata: { orderId: order.id, paymentId: payment.id },
        payment_intent_data: { metadata: { orderId: order.id, paymentId: payment.id } },
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      },
      { idempotencyKey: `checkout-${payment.id}` }
    );

  } catch (error) {
    console.error('Stripe checkout session request failed:', error.type || error.name);
    throw new AppError(502, 'Unable to create a Stripe checkout session. You can safely retry this request.');
  }
  if (!session || !session.id || !session.url || !session.expires_at) {
    throw new AppError(502, 'Stripe did not return a usable checkout session.');
  }

  payment.providerReference = session.id;
  payment.checkoutUrl = session.url;
  payment.expiresAt = new Date(session.expires_at * 1000);
  await payment.save();
  res.status(existingPayment ? 200 : 201).json({
    success: true,
    data: { paymentId: payment.id, checkoutUrl: session.url, expiresAt: payment.expiresAt },
  });
});

exports.getPayment = asyncHandler(async (req, res, next) => {
  const filter = { _id: req.params.id };
  if (req.user.role !== 'admin') filter.customer = req.user._id;
  const payment = await Payment.findOne(filter).select('-checkoutUrl');
  if (!payment) return next(new AppError(404, 'Payment not found.'));
  res.status(200).json({ success: true, data: { payment } });
});

async function applyPaymentResult(payment, order, status) {
  if (!payment || !order || payment.status === 'paid' || order.status === 'paid') return;
  if (status === 'paid') {
    const paidOrder = await Order.findOneAndUpdate(
      { _id: order._id, status: 'pending_payment', paymentStatus: 'pending' },
      { $set: { status: 'paid', paymentStatus: 'paid' } },
      { returnDocument: 'after' }
    );
    if (!paidOrder) {
      const currentOrder = await Order.findById(order._id);
      if (!currentOrder || currentOrder.status !== 'paid') {
        throw new Error(`Stripe confirmed payment for order ${order.id} after it left pending status.`);
      }
    }
    await Payment.updateOne({ _id: payment._id, status: 'pending' }, { $set: { status: 'paid' } });
    return;
  }

  const currentOrder = await Order.findById(order._id);
  if (!currentOrder || currentOrder.status === 'paid') return;
  const mappedStatus = status === 'expired' ? 'expired' : 'failed';
  await Payment.updateOne({ _id: payment._id, status: 'pending' }, { $set: { status: mappedStatus } });
  const mappedOrderStatus = mappedStatus === 'expired' ? 'expired' : 'payment_failed';
  await Order.updateOne(
    { _id: order._id, status: 'pending_payment', paymentStatus: 'pending' },
    { $set: { status: mappedOrderStatus, paymentStatus: mappedStatus } }
  );
  const updatedOrder = await Order.findById(order._id);
  if (updatedOrder) await releaseInventory(updatedOrder);
}

async function processStripeEvent(event) {
  const object = event.data.object;
  let payment;
  if (object.metadata && object.metadata.paymentId) {
    payment = await Payment.findById(object.metadata.paymentId);
  }
  if (!payment && object.id && String(object.id).startsWith('cs_')) {
    payment = await Payment.findOne({ providerReference: object.id });
  }
  if (!payment) return;
  if (
    payment.providerReference &&
    object.id &&
    object.id !== payment.providerReference
  ) {
    throw new Error(`Stripe event reference does not match payment ${payment.id}.`);
  }
  const order = await Order.findById(payment.order);
  if (!order) throw new Error(`Order ${payment.order} for payment ${payment.id} was not found.`);

  if (event.type === 'checkout.session.completed' && object.payment_status === 'paid') {
    if (
      object.amount_total !== Math.round(payment.amount * 100) ||
      String(object.currency).toLowerCase() !== payment.currency
    ) {
      throw new Error(`Stripe amount or currency does not match payment ${payment.id}.`);
    }
    await applyPaymentResult(payment, order, 'paid');
  } else if (event.type === 'checkout.session.async_payment_succeeded') {
    if (
      object.amount_total !== Math.round(payment.amount * 100) ||
      String(object.currency).toLowerCase() !== payment.currency
    ) {
      throw new Error(`Stripe amount or currency does not match payment ${payment.id}.`);
    }
    await applyPaymentResult(payment, order, 'paid');
  } else if (event.type === 'checkout.session.expired') {
    await applyPaymentResult(payment, order, 'expired');
  } else if (event.type === 'checkout.session.async_payment_failed') {
    await applyPaymentResult(payment, order, 'failed');
  }
}

exports.webhook = asyncHandler(async (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError(503, 'Stripe webhook is not configured. Set STRIPE_WEBHOOK_SECRET.');
  }

  let event;
  let stripe;
  try {
    stripe = stripeService.getStripeClient();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, 'Stripe is not configured correctly.');
  }

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.get('stripe-signature'),
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.warn('Rejected Stripe webhook due to signature verification failure.');
    throw new AppError(400, 'Invalid Stripe webhook signature.');
  }

  try {
    await PaymentEvent.create({ providerEventId: event.id, type: event.type });
  } catch (error) {
    if (error.code === 11000) return res.status(200).json({ received: true, duplicate: true });
    throw error;
  }

  try {
    await processStripeEvent(event);
    res.status(200).json({ received: true });
  } catch (error) {
    await PaymentEvent.deleteOne({ providerEventId: event.id });
    throw error;
  }
});
