require('dotenv').config({ quiet: true });
require('dotenv').config({ path: '.env.test', override: true, quiet: true });

const mongoose = require('mongoose');

jest.setTimeout(600000);

let testDatabaseName;

beforeAll(async () => {
  if (!process.env.MONGODB_TEST_URI) {
    throw new Error('Set MONGODB_TEST_URI to a dedicated MongoDB test database before running tests.');
  }

  const testUri = new URL(process.env.MONGODB_TEST_URI);
  const configuredDatabase = decodeURIComponent(
    testUri.pathname.replace(/^\/+/, '').split('/')[0] || ''
  );
  if (!configuredDatabase.toLowerCase().includes('test')) {
    throw new Error('MONGODB_TEST_URI must point to a database whose name includes "test".');
  }

  testDatabaseName = `ecommerce_test_${process.pid}_${Date.now()}`;
  if (!testUri.searchParams.has('authSource')) {
    testUri.searchParams.set('authSource', 'admin');
  }
  testUri.pathname = `/${testDatabaseName}`;
  process.env.MONGODB_URI = testUri.toString();
  process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all(
    Object.values(mongoose.connection.models).map((model) => model.init())
  );
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({}))
  );
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1 && testDatabaseName) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});
