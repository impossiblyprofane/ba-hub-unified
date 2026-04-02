# BA Hub Unified — Broken Arrow Stats Platform

> Community stats viewer, arsenal browser, and deck builder for the Broken Arrow RTS game.

## Architecture

Monorepo with four npm workspaces:

```
ba-hub-unified/
├── frontend/     # Qwik SPA + Fastify metadata-only SSR  (port 3000)
├── backend/      # Fastify + Mercurius GraphQL gateway    (port 3001)
├── database/     # Fastify REST API + Drizzle ORM + PostgreSQL (port 3002)
├── shared/       # Shared TypeScript types (@ba-hub/shared)
├── docs/         # Development & migration documentation
├── docker/       # Production Docker Compose configs
└── scripts/      # Build & setup helpers
```

**Data flow:** Frontend → GraphQL (backend) → REST (database) → PostgreSQL

Static game data (units, weapons, maps, etc.) is loaded from JSON files into the backend at startup. Dynamic data (published decks, likes, challenges) lives in PostgreSQL and is accessed through the database service.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Qwik, Qwik City, Tailwind CSS, TypeScript |
| SSR | Fastify (metadata-only — Discord/social previews) |
| API Gateway | Fastify + Mercurius (GraphQL, WebSocket subscriptions) |
| Database Service | Fastify + Drizzle ORM |
| Database | PostgreSQL (Docker) |
| Static Data | JSON files loaded at startup |
| Shared | TypeScript type definitions (`@ba-hub/shared`) |

## Features

- **Arsenal Browser** — Full unit database with category/faction filtering, detailed stat panels, weapon tables, and modification viewers
- **Deck Builder** — Interactive deck construction with specialization selection, slot/point limits, drag & drop, import/export (deck codes + `.dek` files)
- **Deck Publishing** — Publish decks for the community, browse/filter/like published decks, manage your own publications
- **Map Viewer** — Tactical map analysis with zone overlays
- **i18n** — 9 locales (en, ru, de, fr, zh, es, pt, ko, ja) with game-data locale support

## Development

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)

### Quick Start

```bash
# Install all workspace dependencies
npm install

# Start PostgreSQL container
npm run dev:db

# Run database migrations
npm run dev:migrate

# Start all services (frontend + backend + database)
npm run dev
```

### Individual Services

```bash
npm run dev -w frontend    # Qwik dev server        → http://localhost:3000
npm run dev -w backend     # GraphQL API             → http://localhost:3001/graphql
npm run dev -w database    # Database REST API       → http://localhost:3002
```

GraphiQL playground is available at http://localhost:3001/graphiql when running the backend.

### Build

```bash
# Build all workspaces (shared → database → backend → frontend)
npm run build

# Type-check everything
npm run type-check
```

### Database

PostgreSQL runs in Docker via a dev compose file:

```bash
npm run dev:db          # Start PostgreSQL container
npm run dev:db:stop     # Stop container
npm run dev:db:reset    # Stop + delete volumes (full reset)
npm run dev:migrate     # Run Drizzle migrations
```

Drizzle Kit commands (run from `database/`):

```bash
npm run db:generate     # Generate migration from schema changes
npm run db:migrate      # Apply pending migrations
npm run db:studio       # Open Drizzle Studio GUI
```

## Security Model

The platform uses a **bearer-secret** ownership model for deck publishing — no login system, no passwords.

### How It Works

1. **Identity**: Each user gets a random UUID (`ba_user_id`) stored in `localStorage` on first visit. This UUID acts as both identifier and proof of ownership — it is never shared with other users.

2. **Publishing**: When a user publishes a deck, their UUID is stored as `authorId` in the database.

3. **Ownership Detection**: When viewing a deck, the frontend passes the viewer's UUID as a `viewerId` argument to GraphQL. The **server** compares `viewerId` against the stored `authorId` and returns a boolean `isOwner` field. The actual `authorId` is **never** included in any GraphQL response.

4. **Mutations** (edit/delete): The client sends its UUID as `authorId` in the mutation input. The database service verifies this matches the deck's stored `authorId` before allowing the operation. A one-time math **challenge** (5-minute TTL) must also be solved to prevent automated abuse.

### Why `authorId` is Not Exposed

If `authorId` were returned in API responses, any user could:
- Open DevTools and copy the deck author's UUID
- Set it as their own `ba_user_id` in localStorage
- Solve the math challenge and gain full edit/delete access

By computing `isOwner` server-side and stripping `authorId` from all responses, impersonation requires guessing a 128-bit UUID — computationally infeasible.

### Impersonation Attempt Flow

```
Attacker views victim's deck
  → GraphQL returns { isOwner: false, ... }  (no authorId)
  → No manage controls shown
  → DevTools reveal nothing useful

Attacker forges a mutation with a random/own authorId
  → Database compares against stored authorId → MISMATCH
  → 403 "Not the deck owner"
```

## Production Deployment

```bash
# Docker Compose (all services)
npm run docker:build
npm run docker:up
npm run docker:down
```

| Service | Port |
|---------|------|
| Frontend | 3000 |
| Backend GraphQL | 3001 |
| Database API | 3002 |
| PostgreSQL | 5432 |

## Documentation

- [docs/development.md](docs/development.md) — Detailed dev guide, environment variables, SSR strategy
- [docs/migration-plan.md](docs/migration-plan.md) — Migration from legacy React + Express codebase
- [docker/README.md](docker/README.md) — Docker configuration details

## Project Status

Active development. The platform is a ground-up rebuild of the legacy [ba-hub.net](https://www.ba-hub.net) site, migrating from React + Express to Qwik + Fastify with a proper database layer.