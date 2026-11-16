# Mobile Application

## Overview

React Native Expo mobile client for customer ecommerce shopping. Provides product browsing, search, item reviews, cart management, delivery address selection, native Stripe checkout, and order history.

## Stack

- **Framework**: React Native 0.88, Expo SDK 58
- **Routing**: Expo Router v58 (file based navigation)
- **Styling**: NativeWind v4, Tailwind CSS v3
- **Authentication**: Clerk Expo, Expo SecureStore
- **Payments**: Stripe React Native SDK
- **Data & Telemetry**: TanStack React Query v5, Axios, Sentry React Native

## Key files

| File | Owns |
|---|---|
| `mobile/app/_layout.tsx` | Root provider hierarchy (Clerk, QueryClient, StripeProvider, Sentry) |
| `mobile/app/(tabs)/index.tsx` | Home screen with product search and category filtering |
| `mobile/app/product/[id].tsx` | Product details, image preview, stock indicators, and customer reviews |
| `mobile/app/(tabs)/cart.tsx` | Cart items, address selection modal, and Stripe PaymentSheet checkout |
| `mobile/app/(profile)/orders.tsx` | Customer order history with status and cancellation reason badges |
| `mobile/app/(profile)/addresses.tsx` | Delivery address management and modification modals |

## Commands

```bash
# Install dependencies
npm install

# Start Expo development bundler
npm run start

# Launch on Android emulator or device
npm run android

# Launch on iOS simulator or device
npm run ios

# Run linter
npm run lint
```

## Conventions

- File based routing follows Expo Router layout conventions (`(auth)`, `(tabs)`, `(profile)`).
- Session tokens cache securely in `expo-secure-store` through Clerk token cache helpers.
- Server data fetches use custom React hooks wrapping TanStack Query (`useProducts`, `useCart`, `useOrders`).
- Styling uses NativeWind utility classes on React Native components.

## Gotchas

- Stripe PaymentSheet runs with manual capture; the cart screen polls `/api/orders/by-payment/:id` to confirm final order outcomes.
- On iOS, dismiss modal sheets before presenting alert dialogs to avoid dropped alert presentations.

## Related specs

- [docs/specs/0001-checkout-stock-reservation/index.md](../docs/specs/0001-checkout-stock-reservation/index.md): Authorize, then capture checkout with atomic stock reservation

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._

