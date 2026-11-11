# Scope: Admin Dashboard

The web application for store managers to monitor sales analytics, manage products and inventory, inspect customers, and fulfill orders.

**Build approach:** Tracer Bullet (vertical slices where each feature is built and wired across backend, admin, and mobile together so it works end to end).
**Workflow:** Beta (after develop, check verify then test). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (such as · GA) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Admin foundation & authentication | Foundation | existing |
| 2 | Business analytics & KPI dashboard | Foundation | existing |
| 3 | Product catalog management | Foundation | existing |
| 4 | Order fulfillment management | Slice 1 | in-progress |
| 5 | Customer directory | Foundation | existing |
| 6 | Order management UI refinement | Slice 1 | planned |
| 7 | Inventory adjustment & low stock alerts | Slice 2 | planned |
| 8 | Refund & cancellation resolution console | Slice 2 | planned |

## Foundations

### 1. Admin foundation & authentication · existing
Vite React application scaffold, Tailwind CSS, DaisyUI styling primitives, and Clerk authentication protecting administrative routes.
code in `admin/src/App.jsx` and `admin/src/layouts/DashboardLayout.jsx`

### 2. Business analytics & KPI dashboard · existing
Analytics overview cards calculating gross sales revenue, completed order volume, and total customer counts.
code in `admin/src/pages/DashboardPage.jsx`

### 3. Product catalog management · existing
Product catalog listing table, creation form with Cloudinary multi image upload, product editing modal, and deletion flows.
code in `admin/src/pages/ProductsPage.jsx`

### 5. Customer directory · existing
Customer roster displaying account identities, signup timestamps, and purchase summary records.
code in `admin/src/pages/CustomersPage.jsx`

## Slice 1: Atomic Checkout & Stock Resilience

### 4. Order fulfillment management · in-progress
Order management table displaying real time orders with status tags, handling cancelled orders with reason badges, and guarding against status updates on cancelled orders.
**Done when:** cancelled orders display their specific cancellation badge, cannot have their status edited, and dashboard revenue counts only captured sales.
- [x] Design it (spec): `/architect checkout stock reservation`
- [x] Build it: `/develop checkout stock reservation`
- [ ] Verify it: `/check verify checkout stock reservation`
- [ ] Test it: `/test checkout stock reservation`
Spec 0001 · code in `admin/src/pages/OrdersPage.jsx`

### 6. Order management UI refinement
Polish the order list interface by replacing native alert dialogs with accessible toast alerts and calculating row lock indicators once per render.
**Done when:** status change errors and confirmations appear via toasts, and locked order badges render cleanly without repeated evaluations.
- [ ] Build it: `/develop order management UI refinement`
- [ ] Verify it: `/check verify order management UI refinement`
- [ ] Test it: `/test order management UI refinement`

## Slice 2: Returns & Inventory Control

### 7. Inventory adjustment & low stock alerts · needs a decision
Interactive inventory management interface allowing manual stock increments or decrements with visual alerts when quantities reach critical thresholds.
**Done when:** managers can edit stock quantities directly from the product table and filter products by low stock alerts.
- [ ] Design it (spec): `/architect inventory adjustment & low stock alerts`

### 8. Refund & cancellation resolution console · needs a decision
Administrative console for reviewing orders marked cancelled due to sold out stock or capture issues, with controls to issue manual refunds or return stock.
**Done when:** administrators can inspect cancellation reasons and trigger Stripe refund actions directly from the order view.
- [ ] Design it (spec): `/architect refund & cancellation resolution console`

## Deferred
Out of scope for the current build pass, kept so the plan stays honest.
- **Staff role permissions**: granular permission tiers for read only staff, support agents, and super administrators · needs a decision
- **Financial report export**: CSV and PDF export of order history, taxes, and net revenue · needs a decision
- **Theme toggle**: user selectable dark mode and light mode themes across the administrative dashboard · needs a decision

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

