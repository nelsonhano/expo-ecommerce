# Backend API & Business Logic

## Overview

Express server providing REST endpoints for ecommerce mobile and admin clients. Handles MongoDB persistence, Clerk user synchronization, Cloudinary media uploads, Stripe payments, and Inngest background events.

## Stack

- **Runtime**: Node.js (ES modules)
- **Framework**: Express 5
- **Database**: MongoDB with Mongoose
- **Services**: Clerk Express, Stripe SDK, Inngest, Cloudinary, Multer

## Key files

| File | Owns |
|---|---|
| `backend/src/server.js` | Express app bootstrap, CORS, Clerk middleware, and route mounting |
| `backend/src/config/db.js` | MongoDB Mongoose connection handler |
| `backend/src/config/inngest.js` | Inngest client and Clerk webhook user synchronization handlers |
| `backend/src/services/checkout.service.js` | Two phase checkout reconcile, stock reservation, and Stripe capture |
| `backend/src/controllers/payment.controller.js` | Payment intent initialization and Stripe webhook handler |
| `backend/src/controllers/order.controller.js` | Order lookup by user and by payment intent id |

## Commands

```bash
# Install dependencies
npm install

# Start local server with hot reload
npm run dev

# Seed sample products
npm run seed:products

# Backfill order payment statuses
npm run backfill:orders
```

## Conventions

- Webhook routes requiring raw body payloads mount before global JSON parsing middleware.
- Controllers separate HTTP request handling from core business logic in services.
- Database transactions wrap operations where stock decrements must match order creation atomically.
- Protected routes verify Clerk session tokens via authentication middleware.

## Gotchas

- Raw body parsing is mandatory for Stripe webhook signature validation; do not parse json before `/api/payment/webhook`.
- During concurrent checkouts, stock is checked conditionally (`stock >= quantity`) to prevent negative inventory.

## Related specs

- [docs/specs/0001-checkout-stock-reservation/index.md](../docs/specs/0001-checkout-stock-reservation/index.md): Authorize, then capture checkout with atomic stock reservation

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._

