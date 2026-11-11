# Scope: Mobile Application

The React Native Expo client application providing customers with catalog discovery, cart management, native Stripe payments, and order tracking.

**Build approach:** Tracer Bullet (vertical slices where each feature is built and wired across backend, admin, and mobile together so it works end to end).
**Workflow:** Beta (after develop, check verify then test). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (such as · GA) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Mobile foundation & authentication | Foundation | existing |
| 2 | Product catalog browsing & search | Foundation | existing |
| 3 | Product details & customer reviews | Foundation | existing |
| 4 | Cart management & address selection | Foundation | existing |
| 5 | Customer profile & preferences | Foundation | existing |
| 6 | Native Stripe checkout with order confirmation | Slice 1 | in-progress |
| 7 | Checkout confirmation modal polish & iOS alert timing | Slice 1 | planned |
| 8 | Customer push notifications | Slice 2 | planned |
| 9 | Offline resilience & cache optimization | Slice 3 | planned |

## Foundations

### 1. Mobile foundation & authentication · existing
Expo SDK 54 foundation, Expo Router file based navigation, NativeWind Tailwind styling, and Clerk social authentication with Google and Apple SSO.
code in `mobile/app/_layout.tsx` and `mobile/app/(auth)/index.tsx`

### 2. Product catalog browsing & search · existing
Home catalog view with product cards, real time search filtering, category selection pills, and empty or error states.
code in `mobile/app/(tabs)/index.tsx` and `mobile/components/ProductsGrid.tsx`

### 3. Product details & customer reviews · existing
Detailed product view with multi image preview slider, item specifications, inventory indicators, review lists, and modal review submission form.
code in `mobile/app/product/[id].tsx` and `mobile/components/RatingModal.tsx`

### 4. Cart management & address selection · existing
Cart sheet with quantity increments, removals, subtotal calculation, delivery address selection modal, and inline address creation modal.
code in `mobile/app/(tabs)/cart.tsx` and `mobile/components/AddressSelectionModal.tsx`

### 5. Customer profile & preferences · existing
Account overview screen with navigation to order history, saved addresses, wishlist items, and privacy settings.
code in `mobile/app/(tabs)/profile.tsx` and `mobile/app/(profile)/*`

## Slice 1: Atomic Checkout & Stock Resilience

### 6. Native Stripe checkout with order confirmation · in-progress
Stripe PaymentSheet integration with order outcome polling, presenting customer feedback modals for placed orders, sold out stock releases, and payment retries.
**Done when:** completing payment sheet triggers a confirmation step that informs the customer whether their order succeeded or if sold out stock released their card hold without charges.
- [x] Design it (spec): `/architect checkout stock reservation`
- [x] Build it: `/develop checkout stock reservation`
- [ ] Verify it: `/check verify checkout stock reservation`
- [ ] Test it: `/test checkout stock reservation`
Spec 0001 · code in `mobile/app/(tabs)/cart.tsx` and `mobile/app/(profile)/orders.tsx`

### 7. Checkout confirmation modal polish & iOS alert timing
Refine checkout outcome dismissal so alerts present reliably after modal transitions on iOS devices, and report order outcome polling failures to Sentry.
**Done when:** outcome alerts trigger on iOS without disappearing behind dismissing modal sheets, and unexpected polling errors record telemetry.
- [ ] Build it: `/develop checkout confirmation modal polish & iOS alert timing`
- [ ] Verify it: `/check verify checkout confirmation modal polish & iOS alert timing`
- [ ] Test it: `/test checkout confirmation modal polish & iOS alert timing`

## Slice 2: Customer Notifications

### 8. Customer push notifications · needs a decision
Device push token registration and push notification listeners to alert customers when orders are confirmed, shipped, or delivered.
**Done when:** devices register push tokens on login, and background notifications inform customers of order status transitions.
- [ ] Design it (spec): `/architect customer push notifications`

## Slice 3: Offline Resilience & Performance

### 9. Offline resilience & cache optimization · needs a decision
TanStack Query persistence and optimistic cache updates for cart modifications, address lists, and favorites across intermittent network connections.
**Done when:** customers can browse cached products and update cart quantities smoothly during temporary network drops.
- [ ] Design it (spec): `/architect offline resilience & cache optimization`

## Deferred
Out of scope for the current build pass, kept so the plan stays honest.
- **Biometric quick unlock**: Face ID and fingerprint quick sign in for returning mobile customers · needs a decision
- **Social sharing**: deep link generation for sharing products to messaging apps · needs a decision
- **Saved card wallet management**: customer interface to view and remove saved payment methods · needs a decision

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

