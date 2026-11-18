const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const jwt = require('jsonwebtoken');
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
    expect(listed.body.data.categories).toEqual(['Bags']);
    expect(listed.body.data.currency).toBe((process.env.PAYMENT_CURRENCY || 'usd').toLowerCase());
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
      .send({ items: [{ productId: product.id, quantity: 2, unitPrice: 0.01 }], paymentMethod: 'cash_on_delivery' });
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
    const payload = { items: [{ productId: product.id, quantity: 1 }], paymentMethod: 'cash_on_delivery' };
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
      .send({ items: [{ productId: product.id, quantity: 0 }], totalAmount: 0, paymentMethod: 'cash_on_delivery' });
    expect(response.status).toBe(400);
  });

  test('automatically expires unpaid orders and releases reserved stock only once', async () => {
    process.env.JAZZCASH_ACCOUNT_TITLE = 'Example Store';
    process.env.JAZZCASH_ACCOUNT_NUMBER = '03000000000';
    const { token, product } = await makeCustomerAndProduct(2);
    const created = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product.id, quantity: 1 }], paymentMethod: 'jazzcash' });
    expect(created.status).toBe(201);

    const future = new Date(Date.now() + 25 * 60 * 60 * 1000);
    expect(await expirePendingOrders(future)).toBe(1);
    expect(await expirePendingOrders(future)).toBe(0);
    expect((await Order.findById(created.body.data.order._id)).status).toBe('expired');
    expect((await Product.findById(product.id)).stockQuantity).toBe(2);
  });
});

describe('manual payment methods', () => {
  function configureTransferMethods() {
    process.env.JAZZCASH_ACCOUNT_TITLE = 'Example Store';
    process.env.JAZZCASH_ACCOUNT_NUMBER = '03000000000';
    process.env.EASYPAISA_ACCOUNT_TITLE = 'Example Store';
    process.env.EASYPAISA_ACCOUNT_NUMBER = '03111111111';
    process.env.BANK_ACCOUNT_TITLE = 'Example Store';
    process.env.BANK_NAME = 'Example Bank';
    process.env.BANK_ACCOUNT_NUMBER = '123456789';
  }

  async function createCustomerOrder(paymentMethod) {
    const customer = await register();
    const product = await Product.create({
      name: 'Desk Lamp', description: 'LED lamp', price: 20, category: 'Home', stockQuantity: 4,
    });
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customer.body.data.accessToken}`)
      .send({ items: [{ productId: product.id, quantity: 1 }], paymentMethod });
    return { token: customer.body.data.accessToken, product, response };
  }

  test('lists COD and transfer choices, disabling transfer methods without account details', async () => {
    delete process.env.JAZZCASH_ACCOUNT_TITLE;
    delete process.env.JAZZCASH_ACCOUNT_NUMBER;
    delete process.env.EASYPAISA_ACCOUNT_TITLE;
    delete process.env.EASYPAISA_ACCOUNT_NUMBER;
    delete process.env.BANK_ACCOUNT_TITLE;
    delete process.env.BANK_NAME;
    delete process.env.BANK_ACCOUNT_NUMBER;
    delete process.env.BANK_IBAN;

    const response = await request(app).get('/api/v1/payments/options');
    expect(response.status).toBe(200);
    expect(response.body.data.options.map((option) => option.id)).toEqual([
      'cash_on_delivery', 'jazzcash', 'easypaisa', 'bank_transfer',
    ]);
    expect(response.body.data.options.map((option) => option.enabled)).toEqual([
      true, false, false, false,
    ]);
  });

  test('creates a COD order without an expiry and releases stock when customer cancels', async () => {
    const { token, product, response } = await createCustomerOrder('cash_on_delivery');
    expect(response.status).toBe(201);
    expect(response.body.data.order.reservationExpiresAt).toBeNull();
    expect(response.body.data.payment.method).toBe('cash_on_delivery');
    expect((await Product.findById(product.id)).stockQuantity).toBe(3);

    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    expect(await expirePendingOrders(future)).toBe(0);

    const cancelled = await request(app)
      .post(`/api/v1/orders/${response.body.data.order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancelled.status).toBe(200);
    expect((await Product.findById(product.id)).stockQuantity).toBe(4);
  });

  test('submits a JazzCash reference and lets an admin confirm payment', async () => {
    configureTransferMethods();
    const { token, product, response } = await createCustomerOrder('jazzcash');
    expect(response.status).toBe(201);
    expect(response.body.data.payment.accountDetails.accountNumber).toBe('03000000000');

    const paymentId = response.body.data.payment.id;
    const submitted = await request(app)
      .post(`/api/v1/payments/${paymentId}/submit-reference`)
      .set('Authorization', `Bearer ${token}`)
      .send({ transactionReference: 'JZ-123456' });
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.payment.status).toBe('submitted');
    const forbiddenReview = await request(app)
      .patch(`/api/v1/payments/${paymentId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ decision: 'confirm' });
    expect(forbiddenReview.status).toBe(403);

    const admin = await createAdmin();
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: admin.email,
      password: 'AdminPass1',
    });
    const reviewed = await request(app)
      .patch(`/api/v1/payments/${paymentId}/review`)
      .set('Authorization', `Bearer ${adminLogin.body.data.accessToken}`)
      .send({ decision: 'confirm' });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data.payment.status).toBe('paid');
    expect((await Order.findById(response.body.data.order._id)).paymentStatus).toBe('paid');
    expect((await Product.findById(product.id)).stockQuantity).toBe(3);
  });

  test('rejects a submitted bank transfer and releases its reserved inventory', async () => {
    configureTransferMethods();
    const { token, product, response } = await createCustomerOrder('bank_transfer');
    expect(response.status).toBe(201);
    const paymentId = response.body.data.payment.id;
    await request(app)
      .post(`/api/v1/payments/${paymentId}/submit-reference`)
      .set('Authorization', `Bearer ${token}`)
      .send({ transactionReference: 'BANK-123456' });

    const admin = await createAdmin();
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: admin.email,
      password: 'AdminPass1',
    });
    const rejected = await request(app)
      .patch(`/api/v1/payments/${paymentId}/review`)
      .set('Authorization', `Bearer ${adminLogin.body.data.accessToken}`)
      .send({ decision: 'reject', note: 'Reference not found.' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.payment.status).toBe('rejected');
    expect((await Product.findById(product.id)).stockQuantity).toBe(4);
  });

  test('does not allow another customer to submit a payment reference', async () => {
    configureTransferMethods();
    const { response } = await createCustomerOrder('easypaisa');
    const other = await register('other@example.com');
    const attempt = await request(app)
      .post(`/api/v1/payments/${response.body.data.payment.id}/submit-reference`)
      .set('Authorization', `Bearer ${other.body.data.accessToken}`)
      .send({ transactionReference: 'EP-123456' });
    expect(attempt.status).toBe(409);
  });
});
