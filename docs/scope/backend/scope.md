# Scope: Backend API & Business Logic

The server application providing REST endpoints, MongoDB persistence, Clerk user synchronization, Stripe payments, and background worker queues.

**Build approach:** Tracer Bullet (vertical slices where each feature is built and wired across backend, admin, and mobile together so it works end to end).
**Workflow:** Beta (after develop, check verify then test). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (such as · GA) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Auth & user synchronization | Foundation | existing |
| 2 | Database connection & environment configuration | Foundation | existing |
| 3 | Product catalog API | Foundation | existing |
| 4 | Cart management API | Foundation | existing |
| 5 | Customer addresses & wishlist API | Foundation | existing |
| 6 | Reviews & ratings API | Foundation | existing |
| 7 | Admin operations API | Foundation | existing |
| 8 | Atomic stock reservation & capture | Slice 1 | in-progress |
| 9 | Checkout review findings hardening | Slice 1 | in-progress |
| 10 | Backend automated test suite | Slice 1 | planned |
| 11 | Refund & cancellation API | Slice 2 | planned |
| 12 | Order status event dispatcher | Slice 3 | planned |

## Foundations

### 1. Auth & user synchronization · existing
Authentication middleware decoding Clerk tokens and Inngest background functions synchronizing user records with MongoDB.
code in `backend/src/middleware/auth.middleware.js` and `backend/src/config/inngest.js`

### 2. Database connection & environment configuration · existing
Mongoose connection lifecycle management and validated environment variables for services and credentials.
code in `backend/src/config/db.js` and `backend/src/config/env.js`

### 3. Product catalog API · existing
Public endpoints for product discovery, category filtering, search, and protected endpoints for product creation with Cloudinary image upload.
code in `backend/src/controllers/product.controller.js` and `backend/src/models/product.model.js`

### 4. Cart management API · existing
Customer cart persistence in MongoDB supporting item additions, quantity modifications, removals, and clearing.
code in `backend/src/controllers/cart.controller.js` and `backend/src/models/cart.model.js`

### 5. Customer addresses & wishlist API · existing
Customer profile management for saved delivery addresses and wishlist product toggles.
code in `backend/src/controllers/user.controller.js` and `backend/src/models/user.model.js`

### 6. Reviews & ratings API · existing
Customer product reviews with star ratings and aggregate rating calculation.
code in `backend/src/controllers/review.controller.js` and `backend/src/models/review.model.js`

### 7. Admin operations API · existing
Protected administrator endpoints providing sales metrics, revenue analytics, customer lists, and order status updates.
code in `backend/src/controllers/admin.controller.js`

## Slice 1: Atomic Checkout & Stock Resilience

### 8. Atomic stock reservation & capture · in-progress
Manual capture Stripe checkout where stock is conditionally deducted inside a MongoDB transaction before payment capture, preventing overselling.
**Done when:** concurrent orders for the final item result in exactly one captured order while the other is cancelled without charging the customer card.
- [x] Design it (spec): `/architect checkout stock reservation`
- [x] Build it: `/develop checkout stock reservation`
- [ ] Verify it: `/check verify checkout stock reservation`
- [ ] Test it: `/test checkout stock reservation`
Spec 0001 · code in `backend/src/services/checkout.service.js`

### 9. Checkout review findings hardening · in-progress
Fix the minor review findings in checkout reconciliation: string length validation on address fields, 4xx error status preservation on body parse failures, and refund handling for legacy short stock orders.
**Done when:** malformed address metadata cancels the payment intent cleanly instead of retrying endlessly, and body parse errors return their appropriate HTTP status codes.
- [x] Build it: `/develop checkout review findings hardening`
- [x] Verify it: `/check verify checkout review findings hardening`
- [x] Test it: `/test checkout review findings hardening`
code in `backend/src/services/checkout.service.js` and `backend/src/controllers/payment.controller.js`

### 10. Backend automated test suite · needs a decision
Automated test suite covering concurrent checkout reservations, stock replenishment on cancellation, and webhook replay safety.
**Done when:** automated tests verify all sixteen acceptance criteria in spec 0001 and run cleanly in continuous integration.
- [ ] Design it (spec): `/architect backend automated test suite`

## Slice 2: Returns & Inventory Recovery

### 11. Refund & cancellation API · needs a decision
Endpoints and webhook handlers for releasing held authorizations, issuing Stripe refunds for captured orders, and returning inventory to product stock.
**Done when:** an authorized order cancellation releases the card hold, and a completed order refund returns items to available stock.
- [ ] Design it (spec): `/architect refund & cancellation API`

## Slice 3: Notifications & Events

### 12. Order status event dispatcher · needs a decision
Event emission architecture triggered whenever an order moves between authorized, confirmed, shipped, or cancelled states.
**Done when:** downstream workers receive reliable event payloads for customer notifications and fulfillment tracking.
- [ ] Design it (spec): `/architect order status event dispatcher`

## Deferred
Out of scope for the current build pass, kept so the plan stays honest.
- **Product discounts & coupon codes**: validation rules and percentage discounts · needs a decision
- **Multiple currency conversion**: dynamic exchange rate conversion and Stripe multi currency presentation · needs a decision
- **Bulk catalog export & import**: CSV parsing and bulk database updates for store inventory · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | `/architect` at spec capture | `Design it` ticked; spec linked; `Build it: /develop <feature>` + 2 to 5 milestones; the tier closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA) |
| `in-progress` (building) | `/develop` | milestone sub boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | you, when you decide it is; `/sync` reconciles | boxes you ran ticked; `/sync` captures conventions |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop`.
- **Status** `planned` -> `in-progress` -> `done`, plus `existing` (pre workflow) and `dropped`.
- **Workflow** (header line) is the project default: Beta = `/check verify` then `/test`.

