# CLAUDE.md — BA Hub Unified

Single source of truth for architecture, conventions, and workflows. `docs/development.md` is the quick-start companion; when the two disagree, this file wins.

## What this is

Community stats platform for the Broken Arrow RTS: arsenal browser, deck builder + publishing, match/player stats, map viewer. Ground-up rebuild of the legacy ba-hub.net (React + Express → Qwik + Fastify).

## Architecture

Monorepo, four npm workspaces. **Data flow: Frontend → GraphQL (backend) → REST (database) → PostgreSQL.**

| Workspace | Role | Port |
|---|---|---|
| `frontend/` | Qwik SPA; production served by `src/entry.fastify.tsx` (static SPA + crawler-only metadata SSR via `src/lib/meta/`) | 3000 |
| `backend/` | Fastify + Mercurius GraphQL gateway; static game data from `src/data/static/*.json` loaded into memory at startup; match crawler + stats collector; `/admin/*` REST | 3001 |
| `database/` | Fastify REST + Drizzle ORM; dynamic data (published decks, likes, challenges, crawler state, stats snapshots) | 3002 |
| `shared/` | `@ba-hub/shared` — TypeScript types + crypto helpers. Build it before type-checking anything else | — |

## Commands

```bash
npm install            # all workspaces
npm run dev:db         # local PostgreSQL (docker compose, root compose file)
npm run dev:migrate    # Drizzle migrations
npm run dev            # backend + frontend + database concurrently
npm run build          # shared → database → backend → frontend (order matters)
npm run type-check     # builds shared first, then tsc --noEmit everywhere
npm run test           # backend (vitest) + frontend (vitest)
```

GraphiQL: http://localhost:3001/graphiql

## Branch & deploy model

- **`master` is the only long-lived branch.** Do feature work on short-lived branches, merge to master.
- **Push to `master`** → CI (type-check + tests) → auto-deploy to the **development** environment.
- **Push a `v*` tag** → CI → deploy to **production**. To release: `git tag v3.x.y && git push origin v3.x.y`.
- CI lives in `.github/workflows/ci.yml` (called as a gate by `deploy.yml`, also runs on PRs to master).
- Deploys scp the workspace to the server and `docker compose up -d --build` there (`.github/workflows/deploy.yml`). Dev and prod stacks share one PostgreSQL (`bahub-prod-postgres`); the dev stack runs with `STATS_COLLECTION_ENABLED=false`.
- The legacy `main`/`dev` deploy-trigger branches are retired (see `docs/overhaul-plan.md` §1/§3).

## Frontend data fetching — client-only, no SSR data

**Never ship backend data in the initial HTML.** `routeLoader$` and `useResource$` both resolve during Qwik City SSR and embed data in the response — do not use them for backend data. Use the canonical pattern: `useSignal` + `useVisibleTask$` + skeleton + `GenericErrorView` (template and rationale: `docs/ssr-to-spa-plan.md` §5). All GraphQL calls go through the central client in `frontend/src/lib/graphqlClient.ts`.

The only server-rendered page content is the crawler/bot metadata path (`entry.fastify.tsx` + `src/lib/meta/`), for Discord/Twitter/Google link previews. New page needing a preview → add a resolver in `src/lib/meta/resolvers/` or extend `getStaticRouteMeta()`.

## Environment Variables

Templates: `frontend/.env.example`, `backend/.env.example`, `database/.env.example`. Production values are generated into `docker/.env` by `deploy.yml` from GitHub secrets/vars.

### Backend (`backend/.env`)
```
PORT=3001
DATABASE_SERVICE_URL=http://localhost:3002
FRONTEND_URL=http://localhost:3000        # CORS origin
LOG_LEVEL=info
ADMIN_TOKEN=                              # empty disables /admin/* + /sys
DB_ADMIN_SECRET=                          # shared secret for DB admin proxy
STATS_API_URL=https://api.brokenarrowgame.tech
STATS_PARTNER_TOKEN=
STATS_COLLECTION_ENABLED=true             # false on the dev stack (shared DB)
STEAM_API_KEY=
CRAWLER_PLAYER_COUNT / CRAWLER_CHUNK_SIZE / CRAWLER_BATCH_SIZE /
CRAWLER_BATCH_DELAY_MS / CRAWLER_INTERVAL_MS / SLOW_REQUEST_THRESHOLD_MS
ENCRYPT_API=false                         # + ENCRYPTION_KEY / ENCRYPTION_IV
```

### Database (`database/.env`)
```
PORT=3002
DATABASE_URL=postgresql://bahub:bahub_dev@localhost:5432/bahub
DB_ADMIN_SECRET=
DB_ADMIN_ORIGINS=
```

### Frontend (`frontend/.env`)
```
PORT=3000
SITE_URL=http://localhost:3000
VITE_API_URL=http://localhost:3001/graphql   # baked into the client bundle — MUST be browser-reachable, never an internal hostname
VITE_WS_URL=ws://localhost:3001/graphql
API_URL=http://localhost:3001/graphql        # server-side meta fetch only; may be internal
VITE_ENCRYPTION_KEY= / VITE_ENCRYPTION_IV=   # must match backend ENCRYPTION_*
```

## Security & ownership model

No login system. Each user gets a random UUID (`ba_user_id`) in localStorage — it is both identity and bearer secret.

- `authorId` is stored on published decks but **never returned by any API response**. The server compares the viewer's UUID against it and returns a computed `isOwner: boolean`.
- Type-layer enforcement in `@ba-hub/shared`: `RawPublishedDeck*` (with `authorId`, internal) vs `PublishedDeck*` (with `isOwner`, client-facing). Keep this split when adding fields.
- Mutations require the UUID to match the stored `authorId` **and** a one-time math challenge (5-min TTL, `database/src/routes/challenges.ts`).
- API encryption (`ENCRYPT_API` / `VITE_ENCRYPTION_*`) is anti-scraping obfuscation only — the keys ship to the browser; it is not a security boundary.

## Hidden Admin Panel — `/sys`

Token-gated admin/inspection panel at the unlisted route `frontend/src/routes/sys/index.tsx`, backed by the backend's `/admin/*` REST endpoints (`backend/src/routes/admin.ts`: metrics, log buffer, crawler control) and DB admin operations gated by `DB_ADMIN_SECRET`/`DB_ADMIN_ORIGINS` on the database service. Dormant unless `ADMIN_TOKEN` is set. Not linked from anywhere — keep it that way.

## Conventions & gotchas

- **i18n is mandatory** for all user-facing frontend text: 9 locales, dot-notated keys, English (`frontend/src/lib/i18n/locales/en.ts`) is canonical; helpers return keys, components resolve via `t()`. Game-data strings use the separate `gameLocales.ts` system. Full rules: `.github/copilot-instructions.md` §i18n.
- **Icon paths mix separators** (`RU\BTR_82A\…` vs `DLC2/JALAVAE_JAGU/…`) — always normalize with `value.replace(/\\/g, "/")` before splitting (`frontend/src/lib/iconPaths.ts`).
- **Panel/surface styling** follows the transparent-first pattern (no solid panel backgrounds; rgba borders, not Tailwind `/opacity` on CSS vars — it silently fails). Full spec: `.github/copilot-instructions.md` §Panel & surface styling.
- Deck codes: XOR cipher + base64, encoder in `frontend/src/lib/deck/deckEncoder.ts`; deck import bypasses the wizard and produces a full `EditorDeck`.
- Static-data loader tolerates missing JSON files (empty array + warning) — keep that behavior when adding tables.

## Docs map

- `docs/development.md` — quick-start, project structure, workspace commands
- `docs/overhaul-plan.md` — repo cleanup/refactor plan + branch audit (2026-07)
- `docs/ssr-to-spa-plan.md` — completed SSR→SPA conversion; canonical client-fetch template
- `docker/README.md` — container/compose details
