# Admin Dashboard

## Overview

Vite React single page application for store administration. Provides real time sales analytics, product catalog management with image uploads, order fulfillment, and customer records.

## Stack

- **Build tool**: Vite 7
- **UI Framework**: React 19
- **Routing**: React Router 7
- **Styling**: Tailwind CSS v4, DaisyUI 5
- **State & Data**: TanStack React Query v5, Axios
- **Auth & Telemetry**: Clerk React, Sentry React

## Key files

| File | Owns |
|---|---|
| `admin/src/App.jsx` | Application router, Clerk authentication guards, and layout wrapping |
| `admin/src/pages/DashboardPage.jsx` | Sales analytics, revenue figures, and recent order listings |
| `admin/src/pages/ProductsPage.jsx` | Product table, Cloudinary image upload, and product editing modal |
| `admin/src/pages/OrdersPage.jsx` | Order status tracking, cancellation reason badges, and update locking |
| `admin/src/pages/CustomersPage.jsx` | Customer directory and purchase histories |
| `admin/src/lib/axios.js` | Axios client configured with API base URL and Clerk credentials |

## Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build production bundle
npm run build

# Run linter
npm run lint
```

## Conventions

- API requests use the shared Axios instance with credentials enabled for authentication cookies.
- Queries and mutations use TanStack Query with automatic cache invalidation on mutations.
- Protected routes render inside `DashboardLayout` after verifying Clerk authentication.
- Order statuses for cancelled orders cannot be modified; actions are disabled in the interface.

## Gotchas

- Cancelled orders lock status dropdowns; the API returns conflict status (409) if attempted.
- Product editing requires selecting valid categories matching the backend enum.

## Related specs

- [docs/specs/0001-checkout-stock-reservation/index.md](../docs/specs/0001-checkout-stock-reservation/index.md): Authorize, then capture checkout with atomic stock reservation

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._

