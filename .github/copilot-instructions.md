# Copilot instructions for BA Hub Unified

## Big picture architecture
- Monorepo with npm workspaces: frontend (Qwik SPA), backend (Fastify + Mercurius GraphQL), shared (TypeScript types). See root [package.json](package.json).
- Backend serves GraphQL and WebSocket subscriptions via Mercurius. Entry: [backend/src/index.ts](backend/src/index.ts).
- Backend data is static JSON tables loaded once at startup into typed arrays. Loader: [backend/src/data/loader.ts](backend/src/data/loader.ts). Data files live in [backend/src/data/static](backend/src/data/static).
- Frontend is Qwik with Qwik City routing; metadata-only SSR is handled by a Fastify server that serves SPA HTML and crawler-specific metadata. See [frontend/server/index.ts](frontend/server/index.ts), [frontend/src/root.tsx](frontend/src/root.tsx).
- Shared types are published as @ba-hub/shared and imported by backend for static data typing. See [shared/src/types](shared/src/types).

## Critical workflows
- Dev (root): `npm run dev` runs backend + frontend concurrently. See scripts in [package.json](package.json).
- Backend dev: `npm run dev -w backend` (tsx watch). See [backend/package.json](backend/package.json).
- Frontend dev: `npm run dev -w frontend` (Vite SSR mode). See [frontend/package.json](frontend/package.json).
- Build: `npm run build` (shared → backend → frontend). See [package.json](package.json).
- Docker: `npm run docker:build` / `npm run docker:up`. See [docker/README.md](docker/README.md).

## Project-specific patterns
- Static data loader tolerates missing JSON files by returning empty arrays and logging warnings (ENOENT). Keep this behavior when adding new tables. See `loadJsonArray()` in [backend/src/data/loader.ts](backend/src/data/loader.ts).
- GraphQL schema/resolvers are defined in separate files and wired into Mercurius. See [backend/src/graphql/schema.ts](backend/src/graphql/schema.ts) and [backend/src/graphql/resolvers.ts](backend/src/graphql/resolvers.ts).
- Qwik routes live under [frontend/src/routes](frontend/src/routes) using `component$` and `DocumentHead` (example: [frontend/src/routes/index.tsx](frontend/src/routes/index.tsx)).
- Metadata-only SSR is intentionally minimal for crawlers and does not render full SPA content. Changes to SEO metadata should coordinate [frontend/server/index.ts](frontend/server/index.ts) and Qwik `DocumentHead`.

## Integration points
- Frontend expects backend GraphQL at http://localhost:3001/graphql in dev (see [docker/README.md](docker/README.md) for ports).
- Backend CORS allows the frontend origin (default http://localhost:3000). Config in [backend/src/index.ts](backend/src/index.ts).
- Static data table types come from @ba-hub/shared; update shared types before adding new JSON files. See [shared/src/types](shared/src/types).

## Legacy reference
- The current rebuild is based on the legacy production site https://www.ba-hub.net; use it only as a UX/feature reference, not as a source of code or API contracts.
