# API request and response examples

Base URL: `http://localhost:5000/api/v1`. Requests with an access token must
include `Authorization: Bearer <accessToken>`.

Success responses use `{ "success": true, "data": ... }`. Errors use
`{ "success": false, "message": "..." }`. A validation error is HTTP 400;
missing/expired authentication is 401; insufficient permission is 403; a
missing or non-owned resource is 404; duplicate values or insufficient stock
are 409; unavailable payment configuration is 503.

## Authentication

| Endpoint | Request body | Success response data |
|---|---|---|
| `POST /auth/register` | `{"firstName":"Alex","lastName":"Lee","email":"alex@example.com","password":"StrongPass1"}` | `{"user":{"id":"...","firstName":"Alex","lastName":"Lee","email":"alex@example.com","role":"customer"},"accessToken":"...","refreshToken":"..."}` (201) |
| `POST /auth/login` | `{"email":"alex@example.com","password":"StrongPass1"}` | Same user and token shape as registration (200) |
| `POST /auth/refresh` | `{"refreshToken":"..."}` | `{"accessToken":"...","refreshToken":"..."}`; old refresh token is revoked (200) |
| `POST /auth/logout` | None | `{"success":true,"message":"Logged out successfully."}` (200) |
| `GET /auth/profile` | None | `{"user":{"id":"...","firstName":"Alex","lastName":"Lee","email":"alex@example.com","role":"customer"}}` (200) |
| `PATCH /auth/profile` | `{"firstName":"Alexandra"}` and/or `{"lastName":"Lee"}` | Updated public `user` object (200) |
| `POST /auth/change-password` | `{"currentPassword":"StrongPass1","newPassword":"NewStrongPass2"}` | Success message; all earlier tokens are revoked (200) |
| `POST /auth/password-reset` | `{"email":"alex@example.com"}` | Generic message regardless of account existence; development also includes a one-time `resetToken` (200) |
| `POST /auth/password-reset/confirm` | `{"token":"...","newPassword":"NewStrongPass2"}` | Success message; user must log in again (200) |

Registration ignores any role supplied by the client. Passwords must have at
least eight characters and include uppercase, lowercase, and a number. Password
hashes and refresh-token hashes are never returned.

## Products

| Endpoint | Request | Success response |
|---|---|---|
| `GET /products?search=bag&category=Accessories&minPrice=2&maxPrice=50&inStock=true&page=1&limit=20` | Query parameters optional | `{"products":[...],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}` (200) |
| `GET /products/:id` | None | `{"product":{...}}` (200) |
| `POST /products` | Admin; JSON fields `name`, `description`, `price`, `category`, `stockQuantity`; optional multipart image field `image` | `{"product":{...}}` (201) |
| `PATCH /products/:id` | Admin; any mutable product fields; optional multipart image | `{"product":{...}}` (200) |
| `DELETE /products/:id` | Admin; none | Deactivated `{"product":{...,"isActive":false}}` (200) |

Prices must be positive with at most two decimal places; stock is a
non-negative integer. Image files must be at most 5 MB and contain valid JPEG,
PNG, or WebP signatures.

## Orders

| Endpoint | Request body | Success response |
|---|---|---|
| `POST /orders` | `{"items":[{"productId":"<MongoDB id>","quantity":2}]}` | `{"order":{"orderNumber":"ORD-...","items":[{"product":"...","productName":"Bag","quantity":2,"unitPrice":24.99,"subtotal":49.98}],"totalAmount":49.98,"currency":"usd","status":"pending_payment","paymentStatus":"pending"}}` (201) |
| `GET /orders?page=1&limit=20` | None | `{"orders":[...],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}` (200) |
| `GET /orders/:id` | None | `{"order":{...}}` (200) |

The server chooses the price and currency from trusted configuration. A
customer sees only their own orders; an administrator may list/retrieve all.

## Payments

| Endpoint | Request body | Success response |
|---|---|---|
| `POST /payments/create-checkout-session` | `{"orderId":"<MongoDB id>"}` | `{"paymentId":"...","checkoutUrl":"https://checkout.stripe.com/...","expiresAt":"..."}` (201; repeated active request reuses the session with 200) |
| `GET /payments/:id` | None | `{"payment":{"order":"...","provider":"stripe","amount":49.98,"currency":"usd","status":"pending"}}` (200); checkout URL is excluded |
| `POST /payments/webhook` | Stripe-generated signed raw JSON body | `{"received":true}`; duplicate event returns `{"received":true,"duplicate":true}` (200) |

The checkout URL is returned only at initiation. Paid order status changes only
after the matching signed Stripe event, including its expected amount and
currency, has been confirmed. Do not use the browser success redirect as proof
of payment.
