# Storefront frontend

The storefront reads active products from the backend's public
`GET /api/v1/products` endpoint. In development, the Vite server proxies API
and `/uploads` requests to `http://localhost:5000`.

## Run locally

1. Start MongoDB and configure `Backend/.env`.
2. Start the backend from `Backend` with `npm run dev`.
3. Start the storefront from `Frontend` with `npm run dev`.

The backend must contain active products to show in the storefront. Product
creation is admin-only; see the backend README for creating an admin account.

## Deployment

Set `VITE_API_URL` to the backend origin when building the frontend, for example
`https://api.example.com` (no `/api/v1` suffix). The backend must allow the
deployed frontend origin in its `CLIENT_URL` setting. Product image URLs use
the same backend origin. If `VITE_API_URL` is empty, the frontend uses
same-origin `/api/v1` and `/uploads` paths, which requires the production web
server or CDN to proxy those paths to the backend.

Product prices use the currency returned by the backend, configured through
`PAYMENT_CURRENCY`.
