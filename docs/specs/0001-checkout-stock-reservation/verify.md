# Verify: checkout stock reservation · spec 0001 · updated 2026-11-07
_Steps derived from spec 0001 acceptance criteria and its Value sourcing table. `/check verify` runs these; `/test` locks the durable ones._

Setup you may want first: a replica set MongoDB (Atlas dev cluster or a single node replica set), `npm run backfill:orders` in `backend/`, and `stripe listen --forward-to localhost:3000/api/payment/webhook` with `payment_intent.amount_capturable_updated`, `payment_intent.canceled`, and `payment_intent.succeeded` forwarded.

## UI / manual
- [ ] Mobile: check out one in stock item with test card 4242 4242 4242 4242 → "Confirming your order…" shows, then "Order placed"; the bought items leave the cart → AC-7, AC-9
- [ ] Mobile: lose a race for the last unit → "Sold out, you were not charged"; the cart still holds exactly what it held before → AC-7, AC-9
- [ ] Mobile: use a card that fails at capture → "Payment didn't go through, you were not charged"; the cart is refetched → AC-7
- [ ] Mobile: stop the webhook forwarder, then pay → after about 15 s, "Your order will appear in My Orders shortly"; restart the forwarder and My Orders shows the outcome → AC-7
- [ ] Mobile: close the app during "Confirming", then reopen My Orders → the outcome is shown → AC-7
- [ ] Mobile My Orders: a cancelled order shows a red "Cancelled" badge and a "You were not charged" note; an authorized order shows "Confirming" → AC-11
- [ ] PaymentSheet only offers card, Apple Pay, and Google Pay → AC-12
- [ ] Admin Orders: a cancelled order shows "Cancelled (sold out)" (or its reason) and an authorized one shows "Awaiting capture", with no status dropdown for either → AC-10, AC-11
- [ ] Admin Dashboard: total revenue and order count include only captured orders → AC-10

## Commands
- [x] `POST /api/payment/create-intent` → response has `clientSecret` and `paymentIntentId`; in Stripe the intent has `capture_method: manual` and `payment_method_types: ["card"]`; metadata `orderItems` is `[{p,q,c}]` with `c` in cents → AC-12, AC-15 (value source: `paymentIntent.id`)
- [x] Cart big enough that `orderItems` JSON passes 500 characters → 400 "Cart too large, please split your order"
- [x] Stock 1, two intents authorized at the same moment → one order `pending/captured`, one `cancelled/canceled` with `cancelReason: sold_out`, stock 0, the loser's intent `canceled` and never captured → AC-1, AC-2
- [x] Cart of A (in stock) and B (stock 0) → no stock change for A or B, order `cancelled`/`sold_out` → AC-3
- [x] `stripe events resend <evt>` for the same intent, several at once → one order, stock taken once → AC-4
- [x] Capture with a permanent card error → stock restored, intent canceled, order `cancelled`/`capture_failed` → AC-5 (value source: `err.type` / HTTP status)
- [x] Capture with a temporary error (network or 5xx) → webhook returns 500, Stripe's retry captures once; a retry that finds the intent already `succeeded` marks the order captured, never cancelled → AC-5
- [x] Cancel an authorized intent in the Stripe dashboard → stock restored, order `cancelled`/`authorization_expired` → AC-6 (value source: release reason)
- [x] `payment_intent.canceled` processed before `amount_capturable_updated` → no order, no stock change → AC-16 (value source: live status from `retrieve`, not the event type)
- [x] Metadata with a deleted product → whole order `cancelled`/`sold_out`, nothing charged; a product listed twice is checked against its total quantity → AC-14
- [x] Change a product's price after `create-intent`, before the webhook → order line price equals `c / 100`, the charged price → AC-15 (value source: `metadata.orderItems[].c`)
- [x] Order `user` and `clerkId` match the paying customer → value source: `metadata.userId`, `metadata.clerkId`
- [x] A short reserve logs the first missing or short product id → value source: the product in the warning log line
- [x] An automatic capture intent from before this shipped, `succeeded` → one order with `paymentResult.status: captured` → AC-13
- [x] `GET /api/orders/by-payment/<id>`: owner gets 200 `{orderId,status,paymentStatus,cancelReason}`; owner before the webhook saves gets 202 `{status:"processing"}` (value source: intent `metadata.clerkId`); another user's token, a made up `pi_x`, or an id not starting with `pi_` gets 404 → AC-8
- [x] Admin `PATCH /api/admin/orders/:id/status` on a cancelled order, or on an authorized one → 409 → AC-10
- [x] Admin `GET /api/admin/stats` → `totalOrders` and `totalRevenue` count only `paymentResult.status: captured` → AC-10
- [x] `npm run backfill:orders` → reports duplicates and exits 1 if any exist, else rewrites `succeeded` to `captured` and builds the unique `paymentResult.id` index (check it in Atlas or with `db.orders.getIndexes()`)

## Acceptance-criteria coverage
- AC-1, AC-2: race step · AC-3: multi item short · AC-4: resend step · AC-5: capture permanent, temporary, and late retry steps · AC-6: dashboard cancel · AC-7: mobile placed, sold out, didn't go through, timeout, closed app · AC-8: by-payment lookup · AC-9: cart after placed and after sold out · AC-10: admin badges, PATCH 409, stats · AC-11: My Orders badges, admin badges · AC-12: create-intent fields, PaymentSheet methods · AC-13: legacy intent · AC-14: deleted and repeated product · AC-15: price change · AC-16: canceled first

## Hardening verification (checkout review findings)
- [x] Address type validation: `POST /api/payment/create-intent` with non string or empty address fields returns 400 with "Valid <field> is required (max 150 characters)"
- [x] Address size limit: `POST /api/payment/create-intent` with shipping address stringified over 500 characters returns 400 with "Shipping address too long, please shorten details"
- [x] Malformed metadata cancellation: reconciling PaymentIntent with invalid or missing metadata cancels authorization at Stripe permanently without 500 retry loops
- [x] Legacy short stock refund: reconciling legacy automatic capture intent with missing or sold out product issues Stripe refund with idempotency key
- [x] Capture failure reason: non recoverable capture failure releases order as `capture_failed` in database before cancelling at Stripe
- [x] Body parse error preservation: sending malformed JSON to Express endpoints returns 400 with "Bad request", not 500
- [x] Admin category preservation: editing a product with custom category in Admin retains category option in select dropdown without form validation errors
- [x] iOS alert presentation: order outcome modal dismissal on iOS presents alert dialog after brief delay without dropping the alert
