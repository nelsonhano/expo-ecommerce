# 0001. Authorize, then capture checkout with atomic stock reservation

**Date**: 2026-11-06
**Status**: Accepted

## Summary

Checkout will stop charging the card straight away. The card is only authorized (money is held, not taken). Then the server takes the stock in one database transaction, and only after that does it capture (actually charge) the payment. If the item sold out while the customer was paying, the hold is cancelled, so they are never charged, and their order shows as cancelled with a note saying so. Building this touches the payment webhook, the order model, one new lookup endpoint, the mobile cart screen, and a few admin screens.

## Requirements

**User stories**:
- As a customer, I want to never be charged for an item that sold out while I was paying, so I can trust the store.
- As a customer, I want to know right after paying whether my order went through, so I'm not left guessing.
- As the store owner, I want stock to never go below zero and revenue figures to count only real sales.

**Acceptance criteria**:
- **AC-1**: When two checkouts for the last unit finish at the same moment, exactly one order ends up captured, the other ends up `cancelled` with `cancelReason: sold_out`, and the product's stock ends at 0, never below.
- **AC-2**: The customer who loses the race is never charged: their PaymentIntent is cancelled (the authorization is released) and no capture is made for it.
- **AC-3**: For a cart with several items, if any item (or any quantity) can't be filled, no stock is taken for that order at all, and the order is `cancelled` with `cancelReason: sold_out`.
- **AC-4**: Repeated or simultaneous webhook deliveries for the same PaymentIntent produce exactly one order and take stock exactly once.
- **AC-5**: If capture fails for good, the stock taken is put back, the PaymentIntent is cancelled (no hold left open), and the order is `cancelled` with `cancelReason: capture_failed`. If capture fails for a temporary reason (network, Stripe 5xx), the webhook retry finishes the capture exactly once. A retry that arrives after the payment was already captured (even days later) marks the order captured and never cancels it.
- **AC-6**: If the authorization is cancelled or expires while the order is still `authorized`, the stock is put back and the order is `cancelled` with `cancelReason: authorization_expired`.
- **AC-7**: After the PaymentSheet completes, the app shows "Confirming your order…" and then one of: "Order placed" (captured), "Sold out, you were not charged" (`sold_out`), or "Payment didn't go through, you were not charged" (`capture_failed` or `authorization_expired`). After either "not charged" message the cart is refetched so current stock shows. If no result arrives within about 15 seconds, it says the order will appear in My Orders shortly. If the app is closed while confirming, My Orders shows the outcome.
- **AC-8**: `GET /api/orders/by-payment/:paymentIntentId` returns the order only to the customer who owns it. Before the webhook has saved the order, the owner gets 202 `{ status: "processing" }`. Anyone else, or an unknown id, gets 404.
- **AC-9**: When an order is captured, its items are removed from the customer's cart (as today). When it is cancelled, the cart is left exactly as it was.
- **AC-10**: Admin: cancelled orders appear in the orders list with a "Cancelled (sold out)" style badge, their status can't be changed (the API returns 409), and dashboard revenue and order count include only captured orders.
- **AC-11**: My Orders in the mobile app shows a cancelled order with a cancelled badge and a "You were not charged" note, and an `authorized` order as "Confirming". The admin list shows an `authorized` order as "Awaiting capture".
- **AC-12**: Checkout offers only cards and card wallets (Apple Pay, Google Pay), which all support a separate capture.
- **AC-13**: PaymentIntents created before this ships (automatic capture) still produce correct orders through the existing webhook path, written with `paymentResult.status: captured`, until that path is removed.
- **AC-14**: A product in the order that no longer exists is treated as sold out (the whole order is cancelled, never charged for a partial order). If the same product appears more than once, its quantities are added up before the stock check.
- **AC-15**: Each order line's price is the price the customer was charged for, even if the product's price changed between checkout and the webhook.
- **AC-16**: Webhook events for one PaymentIntent give the right result in any arrival order. For example, a `payment_intent.canceled` that arrives before `amount_capturable_updated` never leads to stock being taken.

## Decision

_Why this option, and the options weighed: [rationale.md](rationale.md). Verify steps: [verify.md](verify.md)._

**Chosen option**: Option 3: Authorize, then reserve, then capture.

Checkout creates a manual capture PaymentIntent limited to cards and wallets. The webhook takes stock and saves the order together in one MongoDB transaction, then captures the payment, or cancels it if any item ran out.

## Feature design

**Data model sketch** (changes only; confirmed):

| Entity | Field | Type | Rule |
|---|---|---|---|
| Order | `status` | enum | `pending` · `shipped` · `delivered` · `cancelled` (new value) |
| Order | `cancelReason` | string enum, nullable (new) | `sold_out` · `capture_failed` · `authorization_expired`. Set only when `status` is `cancelled` |
| Order | `paymentResult.id` | string | Stripe PaymentIntent id. **Unique, sparse index** (new): one order per payment |
| Order | `paymentResult.status` | string enum (was free text) | `authorized` · `captured` · `canceled` · `capture_failed`. Existing `succeeded` rows are backfilled to `captured` |
| Product | `stock` | number ≥ 0 | Decreased only by a conditional update (`stock >= qty`) inside the reserve transaction; increased only when stock is put back |

Relationships are unchanged: Order N:1 User, Order 1:N order items, order item N:1 Product.

**State transitions** (order, set by the webhook only, unless noted):

```
(no order) ──authorized, stock ok──▶ pending / authorized ──capture ok──▶ pending / captured ──admin──▶ shipped ──admin──▶ delivered
(no order) ──authorized, stock short──▶ cancelled / canceled (sold_out)
pending / authorized ──capture card error──▶ cancelled / capture_failed (capture_failed), stock put back
pending / authorized ──payment_intent.canceled──▶ cancelled / canceled (authorization_expired), stock put back
```

Shown as `status / paymentResult.status`. Admin can only move orders whose `paymentResult.status` is `captured`, and never into or out of `cancelled`.

**Webhook flow** (`POST /api/payment/webhook`):

Stripe doesn't promise event order, and the event payload can be stale. So all three handled events (`payment_intent.amount_capturable_updated`, `payment_intent.canceled`, `payment_intent.succeeded`) go through **one reconcile function**. It fetches the **live** PaymentIntent with `stripe.paymentIntents.retrieve(id)` and acts on its current `status` together with the stored order, never on which event arrived. It is safe to run any number of times. Automatic capture intents (created before this ships) skip it and run the legacy path, which now writes `paymentResult.status: captured` (AC-13).

Reconcile, for a manual capture PaymentIntent:

| Live PI status | Stored order | Action |
|---|---|---|
| `requires_capture` | none | **Reserve** (below). On `ok`, go on to **Capture**. On `short`, go to **Sold out**. |
| `requires_capture` | `authorized` | **Capture** (resume after a crash or a temporary error). |
| `requires_capture` | `cancelled` | Call `stripe.paymentIntents.cancel(id)` (an earlier cancel didn't finish). Treat "already canceled" as success. |
| `succeeded` | none | Reserve. On `ok`, mark captured (below). On `short`, log an error (paid, but no stock) and return 500, so it shows up in alerts. This should be impossible, because capture only happens after reserving. |
| `succeeded` | `authorized` | **Mark captured** (capture worked, but the database write didn't). |
| `succeeded` | `captured` | Run the cart clear again (idempotent), then return 200. |
| `canceled` | `authorized` | **Release** with `authorization_expired` (or with `capture_failed` if a capture failure triggered the cancel). |
| `canceled` | none, or `cancelled` | Do nothing. No stock is ever taken for a dead PaymentIntent (AC-16). |
| `processing`, `requires_payment_method`, or anything else | any | Do nothing, return 200. A later event will come. |

Steps:
- **Reserve.** First build the item list from metadata `orderItems` `{p, q, c}` (c = unit price in cents, saved at intent time). Add up `q` for any product that appears more than once. If any product id doesn't exist, the result is `short` (AC-14). Then call `mongoose.connection.transaction(async (session) => …)`. Inside it, for each item, `findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } }, { session })`. If any update returns null, the callback returns `{ short: productId }` and the transaction is aborted. Otherwise it inserts the order (`pending`, `paymentResult.status: authorized`, line prices from `c`) with `{ session }` and returns `{ ok: true }`. The callback makes **no Stripe calls and changes nothing outside the transaction**, because Mongoose runs it again on a temporary transaction error. A duplicate key error (code 11000) is caught **outside** the transaction: another delivery won, so reload the stored order and run reconcile again with it.
- **Sold out.** Insert the order as `cancelled` / `canceled` / `sold_out`. On a duplicate key error, **reload the stored order and run reconcile again with it, without cancelling at Stripe** (a concurrent delivery may hold a valid `authorized` order). Only when this insert succeeds, call `stripe.paymentIntents.cancel(id)` and log a warning with the order and product ids.
- **Capture.** Call `stripe.paymentIntents.capture(id)` (no idempotency key needed, because reconcile only captures when the live status is `requires_capture`). On success, **Mark captured**. On error, classify by `err.type` and `err.code`, never by message text. `StripeConnectionError`, `StripeAPIError`, `StripeRateLimitError`, or an HTTP status of 500 or higher are temporary: return 500 so Stripe retries. Any other error means fetch the PaymentIntent again and reconcile. If it is still `requires_capture`, the failure is permanent: call `cancel`, then **Release** with `capture_failed`.
- **Mark captured.** Update `{ "paymentResult.id": id, "paymentResult.status": "authorized" }` to `captured`, then run the cart `$pull` (the existing one). The cart clear also runs on every later reconcile that finds `captured`, so a crash between the two steps is healed (AC-9).
- **Release.** In one transaction: update the order `{ "paymentResult.id": id, "paymentResult.status": "authorized" }` to `cancelled` with its reason. Only if that matched one document, add each item's quantity back to stock. The guard on `authorized` means stock is put back at most once.

`amount_capturable_updated` can fire more than once for the same PaymentIntent. Reconcile makes that harmless.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/payment/create-intent` | POST | `cartItems`, `shippingAddress` (unchanged) | `clientSecret`, **`paymentIntentId`** (new) | Clerk (`protectRoute`) | 400 empty cart / bad qty / insufficient stock / bad address, 404 product |
| `/api/payment/webhook` | POST | Stripe event (raw body) | `{ received: true }` | Stripe signature | 400 bad signature, 500 temporary failure (Stripe retries) |
| `/api/orders/by-payment/:paymentIntentId` (new) | GET | `paymentIntentId` (path, must start with `pi_`) | 200 `{ orderId, status, paymentStatus, cancelReason }` · 202 `{ status: "processing" }` when there's no order yet but the PaymentIntent's `metadata.clerkId` is the caller's | Clerk (`protectRoute`) | 404 unknown id or not owner |
| `/api/admin/orders/:orderId/status` | PATCH | `status` (unchanged values) | order | admin | **409** when the order is cancelled or not captured (new) |
| `/api/admin/stats` | GET | none | `totalOrders`, `totalRevenue` now count only `paymentResult.status: captured` | admin | unchanged |

`createPaymentIntent` keeps its early stock check (it fails fast in the common case) and adds `capture_method: "manual"` and `payment_method_types: ["card"]`, replacing `automatic_payment_methods`. Its metadata `orderItems` becomes `{p, q, c}`, where `c` is the unit price in integer cents at intent time. This keeps well inside Stripe's 500 character metadata value limit for normal carts. If the JSON would go over 500 characters, return 400 "Cart too large, please split your order" instead of creating the intent.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| create-intent | `paymentIntentId` | `paymentIntent.id` from Stripe's create call |
| webhook reconcile | what to do | live `status` from `stripe.paymentIntents.retrieve(id)`, plus the stored order looked up by `paymentResult.id` |
| webhook reserve | items and quantities | PaymentIntent `metadata.orderItems` `{p, q}`, with quantities added up per product |
| webhook reserve | order line price | `metadata.orderItems[].c` (unit price in cents saved at intent time), divided by 100. Names and images still come from Product |
| webhook reserve | who the order belongs to | `metadata.userId`, `metadata.clerkId` (existing) |
| webhook reserve | which product was short (for the log) | the first missing product, or the first item whose conditional update returned null |
| webhook capture | whether an error is permanent or temporary | `err.type` and HTTP status (connection, API, rate limit, or 5xx = temporary). Anything else is settled by fetching the PaymentIntent again |
| webhook release | cancel reason | `capture_failed` if this run's capture failed, otherwise `authorization_expired` |
| payment lookup | owner check (order exists) | `req.user.clerkId` (from `protectRoute`) matched to `order.clerkId` |
| payment lookup | owner check (no order yet) | `metadata.clerkId` of the PaymentIntent from `stripe.paymentIntents.retrieve`, matched to `req.user.clerkId`. 202 if it matches, 404 if not or if Stripe says the id doesn't exist |
| mobile confirm screen | which message to show | 202 → keep polling. `paymentStatus: captured` → placed. `status: cancelled` with `cancelReason: sold_out` → sold out. `cancelled` with any other reason → "didn't go through". Others → keep polling |
| mobile confirm screen | timeout | constant: 10 polls × 1.5 s |
| My Orders badge / note | cancelled + "not charged", or "Confirming" | `order.status === "cancelled"`, or `order.paymentResult.status === "authorized"` |
| admin badge text | reason shown, or "Awaiting capture" | `order.cancelReason`, or `paymentResult.status === "authorized"` |
| admin stats | revenue and count | `Order` filtered on `paymentResult.status: "captured"` |

**Key invariants**:
- `Product.stock` is never negative. Every decrease is conditional on `stock >= qty`.
- Stock for an order is taken at most once and put back at most once. Taking it and inserting the `authorized` order are one transaction. Putting it back and moving the order to `cancelled` are one transaction, guarded by the order still being `authorized`.
- At most one order per PaymentIntent (unique index).
- An order is `captured` only after Stripe confirms the capture. A `cancelled` order's PaymentIntent is never captured.
- `cancelReason` is set if and only if `status` is `cancelled`.
- Webhook decisions come from the live PaymentIntent status, never from the event type or a stale payload.
- A transaction callback never calls Stripe or changes outside state (Mongoose may run it again).
- An order is never cancelled while its live PaymentIntent is `succeeded`.

**Security model**: The webhook trusts only signed Stripe events (unchanged). Amounts and items come from server side data (unchanged). The payment lookup filters on both `paymentResult.id` and the caller's `clerkId`, and returns 404 rather than 403, so payment ids can't be probed. Admin status changes stay admin only. No card data touches the server, so PCI scope is unchanged (Stripe hosted PaymentSheet).

**Configuration required**:
- No new environment variables.
- In the Stripe dashboard, the webhook endpoint must also subscribe to `payment_intent.amount_capturable_updated` and `payment_intent.canceled` (in addition to `payment_intent.succeeded`). Without this, orders never get created.

**Critical test scenarios**:
- Happy path: one customer checks out, the authorization arrives, stock goes down, the order is captured, the cart is cleared, the app shows "Order placed". Verifies **AC-7**, **AC-9**.
- Race: stock 1, two authorizations processed at once. One order captured, one cancelled `sold_out`, stock 0, one PaymentIntent cancelled. Verifies **AC-1**, **AC-2**.
- Multi item short: cart with A (in stock) and B (short). No stock change for A or B, order cancelled. Verifies **AC-3**.
- Duplicate delivery: the same event processed twice at once gives one order and one decrement. Verifies **AC-4**.
- Capture permanent and temporary errors: in the first case, stock restored, PaymentIntent cancelled, order cancelled. In the second, a 500, then the retry captures once. A retry arriving after the capture already happened (live status `succeeded`, order `authorized`) marks the order captured and clears the cart. Verifies **AC-5**, **AC-9**.
- Out of order events: `canceled` processed before `amount_capturable_updated` gives no stock change and no order. Verifies **AC-16**.
- Bad metadata: a deleted product cancels the order as sold out, and a product listed twice is checked against its total quantity. Verifies **AC-14**.
- Price change: a product's price changes between intent and webhook, and the order lines still use the charged price. Verifies **AC-15**.
- Authorization expired: `payment_intent.canceled` on an authorized order restores stock. Verifies **AC-6**.
- Auth: another user's token on the payment lookup returns 404. Verifies **AC-8**.
- Admin: PATCH on a cancelled order returns 409, and stats exclude cancelled and authorized orders. Verifies **AC-10**.
- Legacy: an automatic capture `payment_intent.succeeded` with no order still creates the order. Verifies **AC-13**.

## Build plan

Thin end to end slices (Tracer Bullet, assumed, since no build approach is recorded). Each slice leaves checkout working.

1. **Slice 1, the happy path end to end.** Order model: add `cancelled`, `cancelReason`, the `paymentResult.status` enum, and the unique sparse index on `paymentResult.id`. Add a backfill script that sets `paymentResult.status` `succeeded` → `captured`, and stops with a list if duplicate payment ids exist. `createPaymentIntent`: manual capture, `card` only, `{p, q, c}` metadata with the 500 character guard, return `paymentIntentId`. Webhook: the reconcile function with the `requires_capture` → reserve → capture → mark captured path. The legacy automatic path writes `captured`. Satisfies **AC-4**, **AC-9**, **AC-12**, **AC-13**, **AC-14**, **AC-15**.
2. **Slice 2, losing the race.** The sold out step (insert the cancelled order, reconcile again on a duplicate key, cancel the PaymentIntent only after a successful insert, log). Satisfies **AC-1**, **AC-2**, **AC-3**.
3. **Slice 3, failure paths.** The rest of the reconcile table: capture error classification, release in a transaction, `succeeded` with an `authorized` order or with no order, and `canceled` with or without an order. Satisfies **AC-5**, **AC-6**, **AC-16**.
4. **Slice 4, telling the customer.** `GET /api/orders/by-payment/:paymentIntentId` (owner scoped, 202 while processing). Mobile `cart.tsx`: after `presentPaymentSheet`, a confirming state, then polling, then placed / sold out / didn't go through / "shortly" messages, and a cart refetch after a "not charged" result. Mobile `orders.tsx`: cancelled badge colour, the "You were not charged" note, and a "Confirming" label for `authorized`. Add the new fields to `mobile/types`. Satisfies **AC-7**, **AC-8**, **AC-11**.
5. **Slice 5, admin.** `getDashboardStats` filters on `captured`. `updateOrderStatus` returns 409 for cancelled or uncaptured orders. `OrdersPage.jsx` shows the cancelled badge with the reason, or "Awaiting capture", and disables the dropdown for both. Satisfies **AC-10**, **AC-11**.
6. **Tests.** Cover the critical scenarios above against an in memory replica set MongoDB (transactions need a replica set), with Stripe's `retrieve`, `capture`, and `cancel` stubbed so the live status can be set per test. Satisfies **AC-1** to **AC-6**, **AC-8**, **AC-10**, **AC-13** to **AC-16**.

## Migration plan

**Strategy**: feature switched by deploy order, with the old path running alongside the new one until it drains.
**Phases**:
1. In the Stripe dashboard, add the `payment_intent.amount_capturable_updated` and `payment_intent.canceled` events to the webhook. This is harmless before the deploy, because today's handler ignores unknown events.
2. Before deploying, run the backfill (`succeeded` → `captured`). If it reports duplicate payment ids, stop: keep the oldest order for each id, check the extra ones by hand (and fix any stock they took twice), and delete them. Then build the unique index ahead of the deploy (`Order.syncIndexes()` or Atlas), because a transaction needs the collection and index to exist already.
3. Deploy the backend (slices 1 to 3 and 5). New checkouts use manual capture. Intents created before the deploy still finish through the legacy path, which now writes `captured`.
4. Right after the deploy, run the backfill once more, to catch any `succeeded` rows the old code wrote in the gap.
5. Ship the mobile update (slice 4). **Known risk, accepted:** older app versions still show "Order placed" straight away, even when the order ends up cancelled as sold out. Those customers are still never charged, and the cancelled order is visible in their My Orders (shown with the old badge styling). Races are rare and most users update quickly, so a forced update gate isn't worth it at this scale.
6. After about a week with no automatic capture `succeeded` events in the logs, remove the legacy path and the interim refund code.

**Rollback**: Before reverting the backend, find any orders still `authorized` and capture or cancel them in the Stripe dashboard. The old code doesn't handle authorizations, so these would otherwise sit with stock taken until the authorization expires (about 7 days). Then revert the commit. The new fields and the index can stay, since old code ignores them.
**Risks**: The unique index build fails if historical duplicate orders exist (phase 2 catches this). Forgetting phase 1 means no orders get created at all, so check the dashboard first. Transactions need Atlas or another replica set, so a local standalone MongoDB will fail at the reserve step (use a single node replica set in development).

## Consequences

**Positive**:
- A customer is never charged for something they don't get. Statements stay clean, and there's no refund fee.
- Stock can't go negative, and multi item orders are all or nothing.
- Duplicate webhook orders become impossible (unique index).
- Revenue figures count only real sales.
- The customer learns the outcome within seconds of paying.

**Negative / tradeoffs**:
- Payment methods are limited to cards and card wallets. Adding bank debits or Buy Now Pay Later later means revisiting this decision.
- A customer can still lose the last unit after entering card details. They see a pending hold briefly, and a "not charged" message.
- The order now has more states, and every screen and query that reads orders must handle `cancelled` and `authorized`.
- Local development needs a replica set MongoDB for transactions.
- Every webhook makes an extra Stripe API call (`retrieve`), and the payment lookup makes one while an order is processing. That's a small cost in return for correct behaviour when events arrive out of order.
- Until customers update the app, older versions show "Order placed" for an order that later gets cancelled as sold out (accepted risk, see Migration plan phase 5).
- A cart large enough to push metadata past 500 characters is rejected at checkout.
- The webhook becomes the only place orders are made, so a misconfigured webhook stops all orders (that was already true, but now it also leaves authorizations hanging).

**Neutral**:
- A one time data backfill and a new index.
- The legacy automatic capture path lives on for about a week, then is deleted.
- No new infrastructure, environment variables, or background jobs.

## Follow-up

- [ ] Before building, confirm in the Stripe dashboard that only cards (with Apple Pay and Google Pay) are needed for this store, and that the webhook endpoint can be edited to add events.
- [ ] Remove the legacy automatic capture path and the interim refund code once it has drained (Migration plan, phase 5).
- [ ] Set up a development MongoDB as a single node replica set (or point at an Atlas dev cluster) so transactions work locally.
- [ ] No `AGENTS.md` exists yet. Consider running `/audit` so payment and webhook conventions (manual capture, idempotency keys, transactions) are recorded for future work.
- [ ] Out of scope for this spec: admin initiated cancel or refund of a captured order, partial fulfilment with partial capture, and email alerts for sold out cancellations.
