# Copilot instructions for BA Hub Unified

## Big picture architecture
- Monorepo with npm workspaces: frontend (Qwik SPA), backend (Fastify + Mercurius GraphQL), database (Fastify + Drizzle ORM + PostgreSQL), shared (TypeScript types). See root [package.json](../package.json).
- Backend serves GraphQL and WebSocket subscriptions via Mercurius. Entry: [backend/src/index.ts](../backend/src/index.ts).
- Backend data is static JSON tables loaded once at startup into typed arrays. Loader: [backend/src/data/loader.ts](../backend/src/data/loader.ts). Data files live in [backend/src/data/static](../backend/src/data/static).
- Database service is a Fastify REST API using Drizzle ORM with PostgreSQL for dynamic data (published decks, likes, views, challenges, users). Entry: [database/src/index.ts](../database/src/index.ts). Schema: [database/src/schema](../database/src/schema). Routes: [database/src/routes](../database/src/routes).
- Data flow: Frontend → GraphQL (backend) → REST (database) → PostgreSQL. Static game data is served directly from backend memory; dynamic data goes through the database service.
- Frontend is Qwik with Qwik City routing; metadata-only SSR is handled by a Fastify server that serves SPA HTML and crawler-specific metadata. See [frontend/server/index.ts](../frontend/server/index.ts), [frontend/src/root.tsx](../frontend/src/root.tsx).
- Shared types are published as @ba-hub/shared and imported by all workspaces. See [shared/src/types](../shared/src/types).

## Critical workflows
- Dev (root): `npm run dev` runs backend + frontend + database concurrently. See scripts in [package.json](../package.json).
- Backend dev: `npm run dev -w backend` (tsx watch, port 3001). See [backend/package.json](../backend/package.json).
- Frontend dev: `npm run dev -w frontend` (Vite SSR mode, port 3000). See [frontend/package.json](../frontend/package.json).
- Database dev: `npm run dev -w database` (tsx watch, port 3002). See [database/package.json](../database/package.json).
- Database setup: `npm run dev:db` (start PostgreSQL Docker), `npm run dev:migrate` (run Drizzle migrations).
- Build: `npm run build` (shared → database → backend → frontend). See [package.json](../package.json).
- Docker: `npm run docker:build` / `npm run docker:up`. See [docker/README.md](../docker/README.md).

## Project-specific patterns
- Static data loader tolerates missing JSON files by returning empty arrays and logging warnings (ENOENT). Keep this behavior when adding new tables. See `loadJsonArray()` in [backend/src/data/loader.ts](../backend/src/data/loader.ts).
- GraphQL schema/resolvers are defined in separate files and wired into Mercurius. See [backend/src/graphql/schema.ts](../backend/src/graphql/schema.ts) and [backend/src/graphql/resolvers.ts](../backend/src/graphql/resolvers.ts).
- Qwik routes live under [frontend/src/routes](../frontend/src/routes) using `component$` and `DocumentHead` (example: [frontend/src/routes/index.tsx](../frontend/src/routes/index.tsx)).
- Metadata-only SSR is intentionally minimal for crawlers and does not render full SPA content. Changes to SEO metadata should coordinate [frontend/server/index.ts](../frontend/server/index.ts) and Qwik `DocumentHead`.
- UI layout conventions:
  - Unit viewer width is intentionally constrained (target `max-w-[1600px]`) even when the global container is wider.
  - Global page container max width is `2000px`; layouts should scale within it.
  - Prefer minimal padding: avoid layered padding (container + element + sub-element). Use a single, deliberate padding layer if needed, and default to spacing/gaps instead of padding.
  - Titled data panels use a header strip (title + bottom border) and avoid nested padding inside content; keep spacing consistent and minimal.
  - Modifications panel is exempt from the header-strip standardization.
  - Squad Composition groups duplicate loadouts into a single tile with a quantity count.
  - Unit portrait should use `background-size: contain` to fit the full icon.
  - Arsenal grid should scale columns with available width (auto-fill/minmax).
  - Mobility "DROP" is a core stat icon (icon-only), not a separate pill.
- Panel & surface styling — transparent-first pattern (canonical, used in unit viewer):
  - **CRITICAL: Tailwind opacity modifiers (`/15`, `/30`, etc.) do NOT work with `var()` CSS variables** in arbitrary values because Tailwind cannot decompose hex variables into RGB channels. Always use `rgba()` directly instead: `border-[rgba(51,51,51,0.15)]` not `border-[var(--border)]/15`. Reference: `--border: #333` = `rgb(51,51,51)`, `--bg: #1a1a1a` = `rgb(26,26,26)`.
  - **No solid backgrounds.** Panels should never use opaque `bg-[var(--bg-raised)]` or `bg-[var(--bg-raised)]/50`. Instead use `bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)]` so the tactical grid bleeds through.
  - **Containers**: `p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)]`. Add `h-full flex flex-col` when the panel should stretch (`fill` mode).
  - **Headers / title bars**: `<p>` or `<div>` with `font-mono tracking-[0.3em] uppercase text-[var(--text-dim)]`, sized `text-[10px] px-3 py-2` (normal) or `text-[9px] px-2 py-2` (compact). Always end with `border-b border-[rgba(51,51,51,0.3)]` — use 30% opacity borders, not full-strength `border-[var(--border)]`.
  - **Content items**: use `bg-[rgba(26,26,26,0.4)]` for subtle item-level backgrounds. Never solid `bg-[var(--bg-raised)]`.
  - **Borders everywhere** should default to `border-[rgba(51,51,51,0.15)]` (15% opacity) for passive containers like cards, panels, and callout boxes. Use `border-[rgba(51,51,51,0.3)]` for structural dividers (header bottom borders, section separators). Reserve full-strength `border-[var(--border)]` only for interactive elements like inputs, buttons, and the sidebar nav.
  - **Section labels / page tags**: `text-[var(--accent)] text-xs font-mono tracking-[0.3em] uppercase` — keep consistent across all pages.
  - **Community / callout bars**: same transparent gradient pattern, not solid raised backgrounds.
  - The `.corner-brackets` and `.hero-glow` CSS classes from global.css remain available for the home page hero but should not be used on general panels.

## Security & ownership model
- **Bearer-secret auth**: Each user gets a random UUID (`ba_user_id`) in localStorage. This UUID is both identifier and proof of ownership — never exposed to other users.
- **`authorId` is internal-only**: The database stores `authorId` on published decks. GraphQL resolvers **strip `authorId`** from all responses and return a computed `isOwner: boolean` instead. Frontend sends `viewerId` to queries; server compares `viewerId === authorId` internally.
- **`Raw*` types for internal data**: When a field exists in the database but must not reach the client, use separate type layers in `@ba-hub/shared`:
  - `RawPublishedDeck` / `RawPublishedDeckSummary` (with `authorId`) — used by database service + backend databaseClient.
  - `PublishedDeck` / `PublishedDeckSummary` (with `isOwner: boolean`) — used by frontend + GraphQL schema.
- **Challenge verification**: All deck mutations (publish, update, delete) require a one-time math challenge (`challengeId` + `challengeAnswer`). Challenges expire after 5 minutes and are deleted after use. See [database/src/routes/challenges.ts](../database/src/routes/challenges.ts).
- **Ownership check**: Database service verifies `body.authorId === storedDeck.authorId` server-side before any mutation. Returns 403 on mismatch. See [database/src/routes/decks.ts](../database/src/routes/decks.ts).

## Deck builder patterns
- **Deck codes** use an XOR cipher (`BAHUB_DECK_v2` key) + base64 encoding. Numbers are base-36. Delimiters: `|` (top-level), `!` (categories), `#` (units), `,` (fields), `\` (modifications), `/` (modId/optId). Encoder/decoder: [frontend/src/lib/deck/deckEncoder.ts](../frontend/src/lib/deck/deckEncoder.ts).
- **Deck import flow** (decode → hydrate → save → navigate): `decodeDeck(code)` → collect option IDs → parallel fetch specs + options via GraphQL → `compressedToDeck(compressed, optionsById)` → `createDeckFromImport(hydrated, spec1, spec2)` → `saveDeck()` → navigate to `/decks/builder/edit/{deckId}`. Import does NOT go through the wizard — it produces a fully populated `EditorDeck` directly.
- **`EditorDeck`** wraps a `Deck` with editor metadata (maxSlots, maxPoints, spec display names+icons, countryName/flag). Persisted in localStorage as base64-encoded JSON with `deck_` prefix. Service: [frontend/src/lib/deck/deckService.ts](../frontend/src/lib/deck/deckService.ts).
- **Option hydration** must include `ThumbnailOverride` and `PortraitOverride` fields — these replace the unit's label icon and portrait respectively when a modification option is selected (e.g. DLC2 vehicle variants).
- **Slot/point limits** come from summing both specialization fields (e.g. `spec1.ReconSlots + spec2.ReconSlots`, capped at 7). Category mappings are in `DECK_CATEGORIES` from `@ba-hub/shared`.
- **Shared deck types** are in [shared/src/types/deck.ts](../shared/src/types/deck.ts): `Deck`, `Set2`, `UnitConfig`, `DeckModification`, `EditorDeck`, `CompressedDeck`, etc.

## Icon path normalization
- **CRITICAL: Game data uses mixed path separators.** Base fields like `Unit.PortraitFileName` use backslashes (`RU\\BTR_82A\\BTR_82A`). Override fields like `Option.PortraitOverride` use forward slashes (`DLC2/JALAVAE_JAGU/JALAVAE_JAGU`). **All icon path functions must normalize both separators** before splitting. Pattern: `value.replace(/\\/g, "/").split("/")`. See [frontend/src/lib/iconPaths.ts](../frontend/src/lib/iconPaths.ts).
- The same applies to `toOptionPicturePath()` which handles legacy `Weapons\\NAME` format.

## Integration points
- Frontend expects backend GraphQL at http://localhost:3001/graphql in dev (see [docker/README.md](../docker/README.md) for ports).
- Backend CORS allows the frontend origin (default http://localhost:3000). Config in [backend/src/index.ts](../backend/src/index.ts).
- Static data table types come from @ba-hub/shared; update shared types before adding new JSON files. See [shared/src/types](../shared/src/types).

## Legacy reference
- The current rebuild is based on the legacy production site https://www.ba-hub.net; use it only as a UX/feature reference, not as a source of code or API contracts.

## i18n — Internationalization rules
All user-facing text in the frontend **must** go through the i18n locale system. Never hard-code English display strings in components, utility functions, or helper mappers. Follow this checklist for any new or changed text:

### System overview
- 9 locales: `en`, `ru`, `de`, `fr`, `zh`, `es`, `pt`, `ko`, `ja`. English is the canonical source.
- Translation dictionaries are flat `Record<string, string>` with dot-notated keys. See [frontend/src/lib/i18n/locales/en.ts](../frontend/src/lib/i18n/locales/en.ts).
- `t(store, key)` resolves a key → current locale dict → English fallback → raw key. See `t()` in [frontend/src/lib/i18n/context.tsx](../frontend/src/lib/i18n/context.tsx).
- Game-data strings (unit names, map names, etc.) use a **separate** game-locale system via `getGameLocaleValue()` in [frontend/src/lib/i18n/gameLocales.ts](../frontend/src/lib/i18n/gameLocales.ts). All game strings are in a **single unified file** `all_locales.json` (not per-domain files). `GAME_LOCALES.specs`, `.maps`, `.modopts` are backward-compatible aliases pointing to the same table. Lookups are **case-insensitive** via `CI_INDEX`. Do not mix these with UI translation keys.

### Adding new text — mandatory steps
1. **Choose a key** using the hierarchical dot-notation convention: `section.subsection.category.item`. Group related keys under a shared prefix with a section comment.
   - Labels: `unitViewer.weapons.types.trajectory.directShot`
   - Descriptions: `unitViewer.weapons.types.trajectory.desc.directShot`
   - Navigation: `nav.arsenal`
   - Filter UI: `unitViewer.filters.category`
2. **Add the English value** to `frontend/src/lib/i18n/locales/en.ts`. This is always the first and required step — English is the fallback for all other locales.
3. **Return i18n keys from helper functions**, not English strings. Functions like `trajectoryTypeToString()` and `seekerTypeDescription()` must return dot-notated keys (e.g., `'unitViewer.weapons.types.trajectory.desc.directShot'`), never raw English like `'Direct Shot'`.
4. **Resolve keys at the component level** by calling `t(i18n, key)` where `i18n = useI18n()`. Components are the only place where keys get resolved to display text.
5. **Other locale files** (ru.ts, de.ts, etc.) receive translations later. Missing keys automatically fall back to English via the `t()` function — no placeholder needed.

### What NOT to do
- Do not put English strings directly in JSX/TSX for any user-visible text (button labels, tooltips, headers, stat labels, filter options, descriptions, placeholder text).
- Do not resolve keys inside utility/lib functions — they should return keys only. The calling component resolves them.
- Do not use string interpolation to build translation keys dynamically at runtime (e.g., `` `unitViewer.weapons.types.${someVar}` ``); use explicit switch/map returns so keys are statically discoverable.
- Do not duplicate key paths — check `en.ts` for existing keys before adding new ones.

### Known unmigrated helpers (to be fixed)
- All helpers (`trajectoryTypeToString()`, `seekerTypeToString()`, `weaponTypeToString()`) now return i18n keys. When adding new mappers, follow the same pattern.
