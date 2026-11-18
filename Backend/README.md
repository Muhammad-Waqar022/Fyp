# AI-powered e-commerce backend

Backend-only REST API using Node.js, Express, MongoDB, and Mongoose. The API is
versioned under `/api/v1`. No React/frontend code is included.

## Requirements and setup

- Node.js 20+ and npm.
- MongoDB local server or MongoDB Atlas. Compass is a client GUI; it does not
  host/run MongoDB itself.
- From this `Backend` folder run:

  ```powershell
  npm install
  Copy-Item .env.example .env
  ```

- Put your database URI in `MONGODB_URI` in `.env`. Existing deployments using
  `MONGO_URI` are supported as a compatibility alias. Never put `.env` or real
  credentials in source control.
- Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to different random secrets.
  The existing `JWT_SECRET` is accepted for access-token compatibility; when a
  dedicated refresh secret is omitted, a separate signing key is derived from
  `JWT_SECRET`. Set the access/refresh lifetimes as needed.
- Start the server:

  ```powershell
  npm run dev
  ```

  It will listen only after MongoDB connects. Test with
  `curl.exe http://localhost:5000/api/v1/health`; a ready response includes
  `"database":"connected"`.
- Stop with Ctrl+C. The process closes HTTP and MongoDB connections gracefully.

## Admin account

Public registration always creates a `customer`; a submitted role is ignored.
To create an administrator, set the one-time `ADMIN_FIRST_NAME`,
`ADMIN_LAST_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` variables in `.env`, then
run:

```powershell
npm run admin:create
```

The command creates one admin record and exits. Remove the temporary admin
variables from `.env` afterwards. Do not use this command with public input.

## Authentication

Register and login return a short-lived JWT access token and rotating refresh
token. Send the access token as `Authorization: Bearer <accessToken>`. Refresh
tokens are stored only as SHA-256 hashes and can be used once; logout and
password changes increment a token version, invalidating issued access and
refresh tokens. Password reset is intentionally a development workflow:
`POST /auth/password-reset` returns a one-time 15-minute reset token only outside
production. Production needs an email delivery service before exposing reset
tokens to users. Password-reset responses do not disclose whether an account
exists.

Authentication proves which user is making a request; authorization determines
what that user may do. Admin routes check the user's server-side role on every
request. Customers can access only their own order/payment records.

## Products and images

Only active products are public. Product writes require an administrator.
Images are optional local files stored under `uploads/`, limited to 5 MB, with
JPEG/PNG/WebP MIME and file-signature validation. The resulting URL is
`/uploads/<generated-name>`. For production deployment, use persistent object
storage (e.g. Cloudinary) rather than the local filesystem.

For development only, `npm run products:seed-demo` inserts the four sample
storefront products into the configured database. It skips products whose
slugs already exist; do not run this command against a production catalog.

## Orders, inventory, and currency

Checkout accepts product IDs and quantities, loads current prices from MongoDB,
and atomically decrements stock using conditional single-document updates. If
order creation fails, decremented stock is restored. There is no multi-document
transaction dependency, so ordinary standalone MongoDB and Atlas both work.
Cash-on-delivery stock remains reserved until the order is cancelled or an
administrator confirms collection. Bank and wallet transfer reservations expire
after `PAYMENT_RESERVATION_HOURS` (default 24); the expiration job releases
unpaid stock.
The configured currency is `PAYMENT_CURRENCY` (default `usd`); the request
cannot select or alter prices/currency.

## Payment methods

The API offers cash on delivery, JazzCash, Easypaisa, and bank transfer. Wallet
and bank methods are **manual transfers**, not live gateway integrations: set
the account details in `.env`, the customer transfers the order total and
submits a transaction reference, and an administrator confirms or rejects it.
`GET /api/v1/payments/options` reports which methods are configured. Digital
methods stay disabled until their required account details are set. No Stripe
checkout or webhook is used.

JazzCash and Easypaisa gateway checkout can be added later with merchant
accounts, provider credentials, and their official signature/callback flows.
Never mark a transfer as paid based only on a customer-submitted reference.

## API reference

All JSON responses use `{ "success": true, "data": ... }` on success and
`{ "success": false, "message": "..." }` on error unless a webhook response is
being acknowledged.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/health` | Public | API and database readiness |
| POST | `/api/v1/auth/register` | Public | Register customer: `{firstName,lastName,email,password}` |
| POST | `/api/v1/auth/login` | Public | Login: `{email,password}` |
| POST | `/api/v1/auth/refresh` | Public | Rotate token: `{refreshToken}` |
| POST | `/api/v1/auth/logout` | Access token | Revoke sessions |
| GET | `/api/v1/auth/profile` | Access token | Current profile |
| PATCH | `/api/v1/auth/profile` | Access token | Update `firstName` and/or `lastName` |
| POST | `/api/v1/auth/change-password` | Access token | `{currentPassword,newPassword}` |
| POST | `/api/v1/auth/password-reset` | Public | `{email}`; development returns reset token |
| POST | `/api/v1/auth/password-reset/confirm` | Public | `{token,newPassword}` |
| GET | `/api/v1/products` | Public | Search/filter/page active products |
| GET | `/api/v1/products/:id` | Public | Product details |
| POST | `/api/v1/products` | Admin | Create product; multipart image field is `image` |
| PATCH | `/api/v1/products/:id` | Admin | Update product fields/image |
| DELETE | `/api/v1/products/:id` | Admin | Deactivate product (soft delete) |
| POST | `/api/v1/orders` | Customer/admin | `{items:[{productId,quantity}],paymentMethod}` |
| GET | `/api/v1/orders` | Customer/admin | List own orders; admin sees all |
| GET | `/api/v1/orders/:id` | Owner/admin | Order details |
| POST | `/api/v1/orders/:id/cancel` | Owner | Cancel a pending order and release inventory |
| GET | `/api/v1/payments/options` | Public | List payment methods and configured account instructions |
| POST | `/api/v1/payments/:id/submit-reference` | Owner | `{transactionReference}` for a wallet/bank transfer |
| PATCH | `/api/v1/payments/:id/review` | Admin | `{decision:"confirm"}` or `{decision:"reject",note}` |
| GET | `/api/v1/payments/:id` | Owner/admin | Payment status and transfer instructions |

Product list supports `search`, `category`, `minPrice`, `maxPrice`, `inStock`,
`page`, and `limit` (maximum 100). Orders accept optional `page` and `limit`.
Invalid data returns HTTP 400, unauthenticated requests 401, unauthorized
requests 403, unavailable records 404, and unique conflicts 409.

The full request/response reference is in [`docs/api.md`](./docs/api.md).
Examples are in [`postman_collection.json`](./postman_collection.json).
Relationship diagram: [`docs/data-model.md`](./docs/data-model.md).

## Tests

Copy `.env.test.example` to `.env.test` and configure `MONGODB_TEST_URI` to a
separate MongoDB test database. Its database name must contain `test`. The
test setup creates a uniquely named temporary database for each run, then drops
only that database. It does not use the application's `MONGODB_URI` for tests.

Run:

```powershell
npm test
```

Jest/Supertest use the dedicated test MongoDB deployment/database and do not
fall back to the development URI. Tests cover registration, duplicate/weak credentials, login,
refresh/logout revocation, profile permissions, products, order snapshots,
overselling protection, ownership, COD cancellation, manual transfer submission,
admin payment review, and inventory release.

## Structure

- `app.js`: Express middleware and API routes; can be imported in tests.
- `server.js`: environment load, database startup, HTTP lifecycle/shutdown.
- `config/database.js`: MongoDB connection.
- `models/`: Mongoose schemas and indexes.
- `routes/`, `controllers/`, `middleware/`, `validators/`: HTTP endpoints and
  request handling.
- `services/`: manual payment options, stock release, and order expiration.
- `services/orderExpirationService.js`: expires unpaid reservations and returns stock.
- `tests/`: automated API tests.
- `scripts/createAdmin.js`: one-off private administrator creation.
