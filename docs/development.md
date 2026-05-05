# BA Hub Development Guide

> **Authoritative reference:** [`CLAUDE.md`](../CLAUDE.md) at the repo root. This file is a quick-start. When the two disagree, CLAUDE.md wins.

---

## Quick Start

```bash
# Install all workspace dependencies
npm install

# Start PostgreSQL container
npm run dev:db

# Apply Drizzle migrations to the running DB
npm run dev:migrate

# Run frontend + backend + database concurrently
npm run dev
```

| Service | URL |
|---|---|
| Frontend (Qwik dev server) | http://localhost:3000 |
| Backend GraphQL | http://localhost:3001/graphql |
| Backend GraphiQL playground | http://localhost:3001/graphiql |
| Database REST API | http://localhost:3002 |
| PostgreSQL | localhost:5432 (`bahub` / `bahub_dev`) |

---

## Project Structure

```
ba-hub-unified/
├── frontend/     # Qwik SPA + Fastify metadata-only SSR  (port 3000)
│   ├── src/
│   │   ├── routes/         # Qwik City file-based routes
│   │   ├── components/     # Reusable components
│   │   ├── lib/            # graphql-types, queries, i18n, deck/, iconPaths, admin/
│   │   ├── root.tsx        # QwikCityProvider + RouterOutlet
│   │   └── global.css      # Tailwind + CSS variables + tactical grid
│   └── server/index.ts     # Production Fastify server: crawler-meta SSR + static SPA
│
├── backend/      # Fastify + Mercurius GraphQL gateway    (port 3001)
│   ├── src/
│   │   ├── index.ts                # Server entry, plugin wiring, lifecycle
│   │   ├── graphql/                # schema.ts, resolvers.ts, graphql-types.ts
│   │   ├── data/                   # loader.ts, indexes.ts, static/*.json
│   │   ├── services/               # statsClient, statsCollector, matchCrawler,
│   │   │                           # steamProfileClient, databaseClient,
│   │   │                           # logBuffer, requestMetrics, outboundMetrics,
│   │   │                           # graphqlMetrics, dekEncryption
│   │   └── routes/                 # admin.ts (/admin/*), isrRelay.ts
│
├── database/     # Fastify REST API + Drizzle ORM + PostgreSQL (port 3002)
│   ├── src/
│   │   ├── index.ts                # Server entry
│   │   ├── db.ts                   # postgres.js + Drizzle client
│   │   ├── schema/                 # Drizzle table definitions
│   │   └── routes/                 # decks, users, challenges, snapshots,
│   │                               # crawler, admin
│   └── drizzle/                    # Generated migrations (0000..0006)
│
├── shared/       # @ba-hub/shared — TypeScript types + crypto helpers
│   └── src/
│       ├── types/          # Unit, Weapon, Map, Deck, PublishedDeck, …
│       ├── crypto.ts       # AES helpers (anti-scraping obfuscation)
│       └── index.ts        # Barrel export
│
├── docs/         # Development & architectural docs
├── docker/       # Production Docker Compose configs
└── scripts/      # Build & setup helpers
```

**Data flow:** Frontend → GraphQL (backend) → REST (database) → PostgreSQL.
Static game data lives in `backend/src/data/static/*.json` and is loaded into memory at startup. Dynamic data (decks, likes, stats snapshots, crawler state) lives in PostgreSQL.

---

## Workspace Commands

| Task | Command |
|---|---|
| Run everything | `npm run dev` |
| Run a single workspace | `npm run dev -w {frontend,backend,database}` |
| Start PostgreSQL container | `npm run dev:db` |
| Stop PostgreSQL container | `npm run dev:db:stop` |
| Reset PostgreSQL (drop volumes) | `npm run dev:db:reset` |
| Apply pending migrations | `npm run dev:migrate` |
| Build everything (in order) | `npm run build` |
| Type-check everything | `npm run type-check` |
| Build Docker images | `npm run docker:build` |
| Bring stack up | `npm run docker:up` |
| Bring stack down | `npm run docker:down` |

**Build order matters:** `shared → database → backend → frontend`. The root `npm run build` script handles this automatically.

### Drizzle Kit (run from `database/`)

```bash
npm run db:generate     # Generate a new migration from schema diff
npm run db:migrate      # Apply pending migrations
npm run db:studio       # Open Drizzle Studio GUI
```

Migrations live in `database/drizzle/` and are committed to the repo. Current migrations: `0000_icy_dexter_bennett.sql` … `0006_player_profile_columns.sql`.

---

## Environment Variables

Full reference lives in [`CLAUDE.md`](../CLAUDE.md#environment-variables). Highlights:

### Backend (`backend/.env`)
```
PORT=3001
DATABASE_SERVICE_URL=http://localhost:3002
FRONTEND_URL=http://localhost:3000
LOG_LEVEL=info

# Hidden /sys admin panel — empty disables it
ADMIN_TOKEN=
DB_ADMIN_SECRET=

# Stats system
STATS_API_URL=https://api.brokenarrowgame.tech
STATS_PARTNER_TOKEN=
STATS_COLLECTION_ENABLED=true
STEAM_API_KEY=

# Crawler tuning (all optional)
CRAWLER_PLAYER_COUNT=100
CRAWLER_CHUNK_SIZE=15000
CRAWLER_BATCH_SIZE=25
CRAWLER_BATCH_DELAY_MS=40
CRAWLER_INTERVAL_MS=120000
SLOW_REQUEST_THRESHOLD_MS=500

# Optional response encryption (anti-scraping obfuscation only — keys are public)
ENCRYPT_API=false
ENCRYPTION_KEY=
ENCRYPTION_IV=
```

### Database (`database/.env`)
```
PORT=3002
DATABASE_URL=postgresql://bahub:bahub_dev@localhost:5432/bahub
DB_ADMIN_ORIGINS=
```

### Frontend (`frontend/.env`)
```
PORT=3000
SITE_URL=http://localhost:3000
VITE_API_URL=http://localhost:3001/graphql
VITE_ENCRYPTION_KEY=
VITE_ENCRYPTION_IV=
```

> **`VITE_API_URL` must be browser-reachable** in every environment. Do not point it at internal hostnames like `http://backend:3001` — the client calls it directly.

---

## Frontend Data Fetching — In-Flight SSR → SPA Conversion

The frontend has historically used `routeLoader$` and `useResource$` for page data, but **both run during Qwik City SSR** and embed the resolved data in the HTML response. This makes the site trivially scrapeable and obscures all real fetches from frontend debugging.

The active conversion replaces them with a client-only pattern: `useSignal + useVisibleTask$ + skeleton + GenericErrorView`. Read [`docs/ssr-to-spa-plan.md`](./ssr-to-spa-plan.md) before adding any new data-bearing route or touching an existing one — it has the principles, the route inventory, and the canonical template.

The crawler-meta SSR path in `frontend/server/index.ts` (sniffing `User-Agent` and rendering bot-only `<meta>` tags) is **separate and stays untouched**.

---

## Frontend SSR Strategy

The production frontend uses **two completely independent rendering paths**:

1. **Bot/crawler path** — `frontend/server/index.ts`'s `onRequest` hook sniffs `User-Agent`, and for known bots renders a tiny hand-built HTML page via `renderMetaHtml()` / `resolveRouteMeta()`. Used for Discord/Twitter/Google link previews. This is the only path that emits page-specific content server-side.
2. **Real-user path** — Qwik City SSR streams a thin app shell. After the conversion is complete (see above) all backend data fetches happen browser-side after hydration.

When adding a new page that should produce a link preview, update `getRouteMeta()` in `frontend/server/index.ts`.

---

## Hidden Admin Panel — `/sys`

A token-gated admin/inspection panel lives at the unlisted `frontend/src/routes/sys/index.tsx`. It is not linked from anywhere and is dormant unless `ADMIN_TOKEN` is set on the backend. Full architecture, endpoints, and conventions are documented in [`CLAUDE.md → Hidden Admin Panel`](../CLAUDE.md#hidden-admin-panel--sys).

---

## Migration from Legacy

The current rebuild is based on the legacy production site https://www.ba-hub.net (React + Express). Use it only as a UX/feature reference — not as a source of code or API contracts. Old TypeScript definitions can be parked in `shared/src/legacy/` while migrating.
