# 0001 · Rationale: authorize, then capture checkout with atomic stock reservation

_Decision record for [index.md](index.md)._

## Context

The store runs an Express + MongoDB (Atlas) backend and an Expo mobile app that pays through the Stripe PaymentSheet. Today `createPaymentIntent` checks stock, then creates a PaymentIntent that charges the card the moment the customer confirms. The order and the stock change only happen later, in the `payment_intent.succeeded` webhook. Between the check and the webhook there is a gap. Two customers can both pass the check for the last unit, and both can pay.

An interim fix (already in `payment.controller.js`) makes the webhook decrement stock only when enough is left, and refunds the customer who loses. That stops stock going negative. The cost is that the loser is charged and refunded: they see two lines on their statement and may wait days for the money to come back. That hurts trust, and it is the kind of thing that turns into support tickets.

Other weaknesses sit next to this one. The "order already exists" check is a read followed by a write, so two webhook deliveries for the same payment that arrive at the same moment can create two orders. And the admin dashboard adds up every order's `totalPrice`, so any order that isn't a real sale would inflate revenue.

Constraints: payments only (no other regulated data). Card data never touches the server (Stripe holds it). Scale is a small store, so a burst of buyers for one item is rare but real, especially for a restock or a last unit. There is no backend test suite yet. No `AGENTS.md` or scope exists, so the build approach is not recorded; this spec assumes thin end to end slices (Tracer Bullet).

## Options considered

### Option 1: Charge, then refund if sold out (keep the interim fix)

The card is charged on confirm. The webhook takes stock with a conditional update, and refunds the payment when stock has run out.

**Pros**:
- Already built and running. No new states, endpoints, or mobile changes.
- Works with every payment method.

**Cons**:
- The loser is charged and refunded: a visible charge, and a refund that can take days to clear.
- Refunds still cost the processing fee on many pricing plans.
- The customer is told "Order placed" even when it wasn't.

### Option 2: Reserve stock before payment, with a time limit

Stock is taken when the PaymentSheet opens and held for a fixed window (for example 15 minutes). An Inngest delayed job releases it if the payment doesn't finish in time.

**Pros**:
- Once the sheet opens, the customer is guaranteed the item. Nobody loses a race after entering card details.
- Works with every payment method, including ones that can't separate authorize from capture.

**Cons**:
- Abandoned checkouts lock stock for the whole window, so the shop can show "sold out" while nothing has sold.
- Needs a reservation record, an expiry job, and careful handling of a payment that arrives just after its reservation expired (a race of its own).
- Opening and closing the sheet repeatedly can lock up stock, which needs rate limiting.

### Option 3: Authorize, then reserve, then capture

The PaymentIntent uses manual capture. When the authorization succeeds, the webhook takes stock and saves the order in one MongoDB transaction, then captures. If stock ran out, it cancels the authorization instead.

**Pros**:
- The loser is never charged. At most they see a pending hold that drops off.
- Stock is only ever held by a customer who has actually authorized payment, so no phantom "sold out".
- No timers or background jobs. The transaction plus a unique index also fixes duplicate webhook orders.

**Cons**:
- Only payment methods that support a separate capture can be used (cards and card wallets here).
- A customer can still lose the race after entering card details. They need a clear "not charged" message.
- More states on the order (authorized, captured, cancelled) and a new mobile confirming step.

## Rationale

The problem to solve is that the loser of a race gets charged, not that stock goes negative (the interim fix already stops that). Option 3 is the only one that removes the charge without adding stock that sits locked by people who never pay. Option 2 swaps a rare bad outcome (a race for the last unit) for a common one (abandoned carts holding stock), and needs an expiry job with its own timing edge cases. For a small store where races are rare, that's the wrong trade.

The cost of Option 3 is limiting payments to methods that allow a separate capture. You confirmed that cards and wallets are all you need, so the cost is nothing today. Running on Atlas (a replica set) means the stock updates and the order insert can share one transaction. That gives true all or nothing behaviour for multi item carts (AC-3) without hand written undo code. Paired with a unique index on the payment id, it also closes the duplicate webhook gap (AC-4): a second delivery's transaction fails on the duplicate key and rolls back its own stock changes.

Smaller calls made here:
- **`payment_method_types: ["card"]`** rather than `automatic_payment_methods`. The card type already covers Apple Pay and Google Pay in PaymentSheet, and it guarantees that no method lacking separate capture can sneak in when someone toggles a setting in the Stripe dashboard. Runner up: keep automatic methods and rely on Stripe filtering them for manual capture. That's workable, but it's implicit.
- **`mongoose.connection.transaction()`** for the reserve step. It retries temporary transaction errors on its own. Runner up: a manual `startSession` / `withTransaction`, which does the same with more code.
- **Polling every 1.5 s for up to 15 s** in the app. The webhook normally lands in 1 to 3 seconds. Runner up: a push notification, which needs device tokens and is not worth it for a confirm screen.

