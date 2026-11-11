# Scope: Platform Coordination & Shared Systems

Cross cutting coordination, end to end integration verification, and shared development workflows across all applications.

**Build approach:** Tracer Bullet (vertical slices where each feature is built and wired across backend, admin, and mobile together so it works end to end).
**Workflow:** Beta (after develop, check verify then test). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (such as · GA) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Monorepo architecture & documentation | Foundation | existing |
| 2 | Full stack checkout verification | Slice 1 | planned |
| 3 | Production deployment & telemetry verification | Slice 2 | planned |

## Foundations

### 1. Monorepo architecture & documentation · existing
Project documentation outlining system architecture, decoupled workspaces, environment configuration, and spec 0001 checkout invariants.
code in `READ.md`, `README.md`, and `docs/specs/0001-checkout-stock-reservation`

## Slice 1: Atomic Checkout & Stock Resilience

### 2. Full stack checkout verification · needs a decision
End to end integration test proving the complete checkout thread from mobile cart submission through backend Stripe webhook settlement and admin order status locking.
**Done when:** a test script executes simultaneous customer purchases, verifies stock decrements, confirms Stripe payment capture, and verifies locked statuses in the admin dashboard.
- [ ] Design it (spec): `/architect full stack checkout verification`

## Slice 2: Production Readiness

### 3. Production deployment & telemetry verification · needs a decision
Verification of production environment builds across Sevalla, MongoDB connection pooling, and live Sentry issue logging across web and mobile runtimes.
**Done when:** production builds run cleanly, environment secrets are validated on startup, and test error events reach Sentry project dashboards.
- [ ] Design it (spec): `/architect production deployment & telemetry verification`

## Deferred
Out of scope for the current build pass, kept so the plan stays honest.
- **Shared contract packages**: shared TypeScript types package consumed across backend, admin, and mobile · needs a decision
- **Continuous integration pipeline**: GitHub Actions workflow running linters and tests on pull requests · needs a decision

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

