# Full Stack Ecommerce Platform

## Stack

- **Language / Runtime**: Node.js, JavaScript, TypeScript
- **Frameworks**: Express 5, React 19 (Vite), Expo SDK 58 (React Native)
- **Key dependencies**: MongoDB (Mongoose), Clerk, Stripe, Inngest, Cloudinary, TanStack Query, Tailwind CSS
- **Package manager**: npm

## Build approach

Tracer Bullet (vertical end to end slices, thin but complete through every layer).

## Commands

```bash
# Backend dev server
cd backend && npm run dev

# Admin dashboard dev server
cd admin && npm run dev

# Mobile app dev server
cd mobile && npm run start
```

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md`.

## Rules

- Slices touch all relevant folders (backend, admin, mobile) together so features work end to end.
- Backend Stripe webhooks use raw body parsing before standard JSON middleware.
- Stock reductions and order insertions run together in one database transaction before Stripe capture.
- Secrets and keys load from environment files, never hardcoded in source.
- Mobile navigation uses Expo Router file conventions under `mobile/app`.

## Agent skills

MCP servers: Stripe (recommended), MongoDB Atlas (recommended), Sentry (recommended)

## Context files

- [backend/AGENTS.md](backend/AGENTS.md): Express REST API, MongoDB models, Stripe payments, and Inngest jobs
- [admin/AGENTS.md](admin/AGENTS.md): React Vite administration dashboard, catalog control, and order operations
- [mobile/AGENTS.md](mobile/AGENTS.md): Expo React Native client application for catalog discovery and checkout

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._

