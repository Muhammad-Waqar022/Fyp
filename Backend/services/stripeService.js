const Stripe = require('stripe');
const AppError = require('../utils/AppError');

let stripeClient;

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new AppError(503, 'Stripe payments are not configured. Set STRIPE_SECRET_KEY.');
  }
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

module.exports = { getStripeClient };
