const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const PaymentEvent = require('../models/PaymentEvent');
const Stripe = require('stripe');
const jwt = require('jsonwebtoken');
const stripeService = require('../services/stripeService');
const { expirePendingOrders } = require('../services/orderExpirationService');

afterEach(() => {
  jest.restoreAllMocks();
});

async function register(email = 'customer@example.com') {
  return request(app).post('/api/v1/auth/register').send({
    firstName: 'Test',
    lastName: 'Customer',
    email,
    password: 'StrongPass1',
  });
}

async function createAdmin() {
  return User.create({
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    password: 'AdminPass1',
    role: 'admin',
  });
}

describe('authentication and authorization', () => {
  test('registers customer, hashes password, and never returns hash', async () => {
    const response = await register('  CUSTOMER@example.com ');
    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe('customer@example.com');
    expect(response.body.data.user.role).toBe('customer');
    expect(response.body.data).not.toHaveProperty('user.password');
    const saved = await User.findOne({ email: 'customer@example.com' }).select('+password');
    expect(saved.password).not.toBe('StrongPass1');
  });

  test('rejects duplicate registration and weak passwords', async () => {
    await register();
    const duplicate = await register();
    const weak = await request(app).post('/api/v1/auth/register').send({
      firstName: 'Weak', lastName: 'Password', email: 'weak@example.com', password: 'weak',
    });
    expect(duplicate.status).toBe(409);
    expect(weak.status).toBe(400);
  });

  test('authenticates, rotates refresh tokens, protects profile, and revokes logout token', async () => {
    const created = await register();
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@example.com',
      password: 'StrongPass1',
    });
    expect(login.status).toBe(200);

    const oldRefresh = login.body.data.refreshToken;
    const profile = await request(app)
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(profile.status).toBe(200);

    const refreshed = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh });
    expect(refreshed.status).toBe(200);
    const reused = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh });
    expect(reused.status).toBe(401);

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${refreshed.body.data.accessToken}`);
    expect(logout.status).toBe(200);
    const revoked = await request(app)
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${refreshed.body.data.accessToken}`);
    expect(revoked.status).toBe(401);
    expect(created.body.data.accessToken).toBeTruthy();
  });

  test('allows profile name changes but blocks role mass assignment and admin-only endpoints', async () => {
    const customer = await register();
    const changed = await request(app)
      .patch('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${customer.body.data.accessToken}`)
      .send({ firstName: 'Updated', role: 'admin' });
    expect(changed.status).toBe(400);
    const unchanged = await User.findOne({ email: 'customer@example.com' });
    expect(unchanged.role).toBe('customer');

    const forbidden = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${customer.body.data.accessToken}`)
      .send({ name: 'Nope', description: 'Nope', price: 2, category: 'Nope', stockQuantity: 1 });
    expect(forbidden.status).toBe(403);
    expect(await createAdmin()).toBeTruthy();
  });

  test('rejects invalid login credentials', async () => {
    await register();
    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@example.com',
      password: 'WrongPass1',
    });
    expect(response.status).toBe(401);
  });

  test('rejects expired access tokens', async () => {
    const created = await register();
    const user = await User.findOne({ email: 'customer@example.com' }).select('+tokenVersion');
    const expiredToken = jwt.sign(
      { sub: user.id, role: 'customer', tokenVersion: user.tokenVersion },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const response = await request(app)
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(response.status).toBe(401);
    expect(created.status).toBe(201);
  });

  test('supports one-time development password reset', async () => {
    await register();
    const requested = await request(app)
      .post('/api/v1/auth/password-reset')
      .send({ email: 'customer@example.com' });
    expect(requested.status).toBe(200);
    const reset = await request(app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: requested.body.resetToken, newPassword: 'AnotherPass2' });
    expect(reset.status).toBe(200);
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@example.com',
      password: 'AnotherPass2',
    });
    expect(login.status).toBe(200);
  });

  test('changes password and revokes the previous access token', async () => {
    const created = await register();
    const response = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${created.body.data.accessToken}`)
      .send({ currentPassword: 'StrongPass1', newPassword: 'NewStrongPass2' });
    expect(response.status).toBe(200);
    const oldToken = await request(app)
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${created.body.data.accessToken}`);
    expect(oldToken.status).toBe(401);
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@example.com',
      password: 'NewStrongPass2',
    });
    expect(login.status).toBe(200);
  });
});

describe('product management', () => {
  test('creates as admin, lists active products with search/filter/pagination, and deactivates', async () => {
    const admin = await createAdmin();
    const login = await request(app).post('/api/v1/auth/login').send({
      email: admin.email,
      password: 'AdminPass1',
    });
    const token = login.body.data.accessToken;

    const created = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Blue Bag', description: 'Travel bag', price: 14.5, category: 'Bags', stockQuantity: 4 });
    expect(created.status).toBe(201);
    expect(created.body.data.product.slug).toBe('blue-bag');

    const listed = await request(app).get('/api/v1/products?search=blue&category=Bags&page=1&limit=1');
    expect(listed.status).toBe(200);
    expect(listed.body.data.products).toHaveLength(1);
    expect(listed.body.data.pagination.total).toBe(1);

    const invalid = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad', description: 'Bad', price: -1, category: 'Bags', stockQuantity: -1 });
    expect(invalid.status).toBe(400);

    const deactivated = await request(app)
      .delete(`/api/v1/products/${created.body.data.product._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deactivated.status).toBe(200);
    expect((await request(app).get('/api/v1/products')).body.data.products).toHaveLength(0);
  });

  test('rejects image uploads whose file content does not match an allowed image type', async () => {
    const admin = await createAdmin();
    const login = await request(app).post('/api/v1/auth/login').send({
      email: admin.email,
      password: 'AdminPass1',
    });
    const response = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .field('name', 'Fake image')
      .field('description', 'Invalid image data')
      .field('price', '10')
      .field('category', 'Test')
      .field('stockQuantity', '1')
      .attach('image', Buffer.from('not actually a png'), 'fake.png');
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/file content/i);
  });
});

describe('orders and inventory', () => {
  async function makeCustomerAndProduct(stockQuantity = 3) {
    const customer = await register();
    const product = await Product.create({
      name: 'Coffee Maker',
      description: 'Kitchen equipment',
      price: 29.95,
      category: 'Kitchen',
      stockQuantity,
    });
    return { token: customer.body.data.accessToken, product };
  }

  test('calculates totals from DB prices, stores snapshots, and enforces order ownership', async () => {
    const { token, product } = await makeCustomerAndProduct();
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product.id, quantity: 2, unitPrice: 0.01 }] });
    expect(response.status).toBe(201);
    expect(response.body.data.order.totalAmount).toBe(59.9);
    expect(response.body.data.order.items[0].unitPrice).toBe(29.95);
    expect((await Product.findById(product.id)).stockQuantity).toBe(1);

    const another = await register('another@example.com');
    const hidden = await request(app)
      .get(`/api/v1/orders/${response.body.data.order._id}`)
      .set('Authorization', `Bearer ${another.body.data.accessToken}`);
    expect(hidden.status).toBe(404);
  });

  test('prevents overselling under concurrent checkout requests', async () => {
    const { token, product } = await makeCustomerAndProduct(1);
    const payload = { items: [{ productId: product.id, quantity: 1 }] };
    const results = await Promise.all([
      request(app).post('/api/v1/orders').set('Authorization', `Bearer ${token}`).send(payload),
      request(app).post('/api/v1/orders').set('Authorization', `Bearer ${token}`).send(payload),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect((await Product.findById(product.id)).stockQuantity).toBe(0);
    expect(await Order.countDocuments()).toBe(1);
  });

  test('rejects client prices and non-positive quantities', async () => {
    const { token, product } = await makeCustomerAndProduct();
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product.id, quantity: 0 }], totalAmount: 0 });
    expect(response.status).toBe(400);
  });

  test('automatically expires unpaid orders and releases reserved stock only once', async () => {
    const { token, product } = await makeCustomerAndProduct(2);
    const created = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    expect(created.status).toBe(201);

    const future = new Date(Date.now() + 31 * 60 * 1000);
    expect(await expirePendingOrders(future)).toBe(1);
    expect(await expirePendingOrders(future)).toBe(0);
    expect((await Order.findById(created.body.data.order._id)).status).toBe('expired');
    expect((await Product.findById(product.id)).stockQuantity).toBe(2);
  });
});

describe('payments and Stripe webhooks', () => {
  async function makePendingOrder() {
    const customer = await register();
    const user = await User.findOne({ email: 'customer@example.com' });
    const product = await Product.create({
      name: 'Desk Lamp', description: 'LED lamp', price: 20, category: 'Home', stockQuantity: 4,
    });
    await Product.updateOne({ _id: product.id }, { $inc: { stockQuantity: -1 } });
    const order = await Order.create({
      customer: user.id,
      items: [{ product: product.id, productName: product.name, quantity: 1, unitPrice: 20, subtotal: 20 }],
      totalAmount: 20,
      currency: 'usd',
    });
    return { token: customer.body.data.accessToken, product, order };
  }

  test('payment initiation requires configured Stripe test credentials', async () => {
    const { token, order } = await makePendingOrder();
    delete process.env.STRIPE_SECRET_KEY;
    const response = await request(app)
      .post('/api/v1/payments/create-checkout-session')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: order.id });
    expect(response.status).toBe(503);
  });

  test('creates a Stripe checkout session from trusted order snapshots', async () => {
    const { token, order } = await makePendingOrder();
    const createSession = jest.fn().mockResolvedValue({
      id: 'cs_test_checkout',
      url: 'https://checkout.stripe.com/test-session',
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });
    const fakeStripe = { checkout: { sessions: { create: createSession } } };
    jest.spyOn(stripeService, 'getStripeClient').mockReturnValue(fakeStripe);

    const response = await request(app)
      .post('/api/v1/payments/create-checkout-session')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: order.id });
    expect(response.status).toBe(201);
    expect(response.body.data.checkoutUrl).toBe('https://checkout.stripe.com/test-session');
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(createSession.mock.calls[0][0].line_items[0].price_data.unit_amount).toBe(2000);

    const reused = await request(app)
      .post('/api/v1/payments/create-checkout-session')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: order.id });
    expect(reused.status).toBe(200);
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  test('rejects invalid webhook signatures', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_not_a_real_secret';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
    const response = await request(app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', 'invalid')
      .set('Content-Type', 'application/json')
      .send('{}');
    expect(response.status).toBe(400);
  });

  test('processes signed failed-payment webhook once and releases inventory once', async () => {
    const { product, order } = await makePendingOrder();
    const payment = await Payment.create({
      order: order.id,
      customer: order.customer,
      providerReference: 'cs_test_failed',
      amount: 20,
      currency: 'usd',
    });
    process.env.STRIPE_SECRET_KEY = 'sk_test_not_a_real_secret';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const payload = JSON.stringify({
      id: 'evt_test_failed_once',
      object: 'event',
      type: 'checkout.session.async_payment_failed',
      data: { object: { id: 'cs_test_failed', object: 'checkout.session', metadata: { paymentId: payment.id } } },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });

    const first = await request(app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload);
    const repeated = await request(app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(first.status).toBe(200);
    expect(repeated.body.duplicate).toBe(true);
    expect((await Order.findById(order.id)).status).toBe('payment_failed');
    expect((await Product.findById(product.id)).stockQuantity).toBe(4);
    expect(await PaymentEvent.countDocuments()).toBe(1);
    expect(mongoose.connection.readyState).toBe(1);
  });

  test('marks an order paid only after a valid signed Stripe confirmation', async () => {
    const { product, order } = await makePendingOrder();
    const payment = await Payment.create({
      order: order.id,
      customer: order.customer,
      providerReference: 'cs_test_paid',
      amount: 20,
      currency: 'usd',
    });
    process.env.STRIPE_SECRET_KEY = 'sk_test_not_a_real_secret';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const payload = JSON.stringify({
      id: 'evt_test_paid_once',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_paid',
          object: 'checkout.session',
          payment_status: 'paid',
          amount_total: 2000,
          currency: 'usd',
          metadata: { paymentId: payment.id },
        },
      },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    const response = await request(app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(response.status).toBe(200);
    expect((await Order.findById(order.id)).paymentStatus).toBe('paid');
    expect((await Payment.findById(payment.id)).status).toBe('paid');
    expect((await Product.findById(product.id)).stockQuantity).toBe(3);
  });

  test('does not allow another customer to create payment for the order', async () => {
    const { order } = await makePendingOrder();
    const other = await register('other@example.com');
    const response = await request(app)
      .post('/api/v1/payments/create-checkout-session')
      .set('Authorization', `Bearer ${other.body.data.accessToken}`)
      .send({ orderId: order.id });
    expect(response.status).toBe(404);
  });
});
