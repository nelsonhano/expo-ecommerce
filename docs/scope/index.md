# Scope: Full Stack Ecommerce Platform

A production ecommerce platform comprising a React Native mobile application, a React administration dashboard, and an Express server with MongoDB.

**Build approach:** Tracer Bullet (vertical slices where each feature is built and wired across backend, admin, and mobile together so it works end to end).
**Workflow:** Beta (after develop, check verify then test). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (such as · GA) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## Workspaces

| Workspace | Description | Status Rollup | Scope Link |
|---|---|---|---|
| `backend` | Express API, database persistence, Stripe payments, and Inngest jobs | 7 / 12 complete (2 in-progress, 3 planned) | [backend/scope.md](backend/scope.md) |
| `admin` | React Vite administration dashboard for metrics, catalog, and orders | 4 / 8 complete (1 in-progress, 3 planned) | [admin/scope.md](admin/scope.md) |
| `mobile` | React Native Expo mobile app for shopping, cart, and order tracking | 5 / 9 complete (1 in-progress, 3 planned) | [mobile/scope.md](mobile/scope.md) |
| `_root` | Platform wide coordination, full stack verification, and deployment | 1 / 3 complete (0 in-progress, 2 planned) | [_root/scope.md](_root/scope.md) |

## At a glance across all workspaces

| # | Workspace | Feature | Phase | Status |
|---|---|---------|-------|--------|
| 1 | `backend` | Auth & user synchronization | Foundation | existing |
| 2 | `backend` | Database connection & environment configuration | Foundation | existing |
| 3 | `backend` | Product catalog API | Foundation | existing |
| 4 | `backend` | Cart management API | Foundation | existing |
| 5 | `backend` | Customer addresses & wishlist API | Foundation | existing |
| 6 | `backend` | Reviews & ratings API | Foundation | existing |
| 7 | `backend` | Admin operations API | Foundation | existing |
| 8 | `admin` | Admin foundation & authentication | Foundation | existing |
| 9 | `admin` | Business analytics & KPI dashboard | Foundation | existing |
| 10 | `admin` | Product catalog management | Foundation | existing |
| 11 | `admin` | Customer directory | Foundation | existing |
| 12 | `mobile` | Mobile foundation & authentication | Foundation | existing |
| 13 | `mobile` | Product catalog browsing & search | Foundation | existing |
| 14 | `mobile` | Product details & customer reviews | Foundation | existing |
| 15 | `mobile` | Cart management & address selection | Foundation | existing |
| 16 | `mobile` | Customer profile & preferences | Foundation | existing |
| 17 | `_root` | Monorepo architecture & documentation | Foundation | existing |
| 18 | `backend` | Atomic stock reservation & capture | Slice 1 | in-progress |
| 19 | `admin` | Order fulfillment management | Slice 1 | in-progress |
| 20 | `mobile` | Native Stripe checkout with order confirmation | Slice 1 | in-progress |
| 21 | `backend` | Checkout review findings hardening | Slice 1 | in-progress |
| 22 | `admin` | Order management UI refinement | Slice 1 | planned |
| 23 | `mobile` | Checkout confirmation modal polish & iOS alert timing | Slice 1 | planned |
| 24 | `backend` | Backend automated test suite | Slice 1 | planned |
| 25 | `_root` | Full stack checkout verification | Slice 1 | planned |
| 26 | `backend` | Refund & cancellation API | Slice 2 | planned |
| 27 | `admin` | Inventory adjustment & low stock alerts | Slice 2 | planned |
| 28 | `admin` | Refund & cancellation resolution console | Slice 2 | planned |
| 29 | `mobile` | Customer push notifications | Slice 2 | planned |
| 30 | `_root` | Production deployment & telemetry verification | Slice 2 | planned |
| 31 | `backend` | Order status event dispatcher | Slice 3 | planned |
| 32 | `mobile` | Offline resilience & cache optimization | Slice 3 | planned |

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

