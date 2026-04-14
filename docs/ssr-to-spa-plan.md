# SSR → SPA Conversion Plan

**Status:** Superseded by encrypted-SSR re-conversion (see §15 below)
**Scope:** `frontend/` (Qwik City SPA on port 3000)
**Branch:** `main` (`dev` is in limbo, do not use)
**Owner:** TBD
**Last updated:** 2026-04-08

---

## 1. Problem statement

The frontend currently has **two different notions of SSR** fighting each other, and the code in production is doing more server-side rendering than was intended.

### 1.1 What was intended
> "SSR is only for metadata. Everything else is SPA behaviour."

Real users should get a thin HTML shell. All page data should be fetched from the browser after hydration, giving us:
- Scraping friction (a `curl` returns nothing useful)
- Clean separation of "boot" vs "data"
- Observable network traffic in DevTools for debugging
- Normal SPA loading states

Bots/crawlers (Discord, Twitter, Google, etc.) should get a hand-rolled HTML page containing only `<meta>` tags for link previews.

### 1.2 What is actually deployed
`frontend/src/entry.fastify.tsx` (the production entry point) wires up **full Qwik City SSR** via `createQwikCity({ render, qwikCityPlan })`. On top of that, individual route files declare `routeLoader$` hooks that fetch data from the GraphQL backend server-side. The resulting HTML response contains fully-populated stats, tables, and text — visible as a plain HTML document before any JavaScript runs.

A real user hitting `/stats/player/{steamId}` receives a single HTML response that already contains the player's name, ELO, K/D, win rate, recent match list, unit usage tables, spec combinations, etc. The only client-side GraphQL calls visible in DevTools are the Steam avatar fetch and a secondary profile query.

This is the direct opposite of the stated intent. It:
- Makes the site trivially scrapeable (`curl | pup`)
- Hides all the real data fetches from frontend debugging
- Forces the Fastify frontend server to do work it wasn't supposed to do
- Couples page rendering to backend availability at HTTP response time

### 1.3 Crawler metadata path is separate and already correct
`entry.fastify.tsx` has an `onRequest` hook that sniffs the `User-Agent` for known bot patterns and, for bots, serves a tiny hand-built HTML page via `renderMetaHtml()` / `resolveRouteMeta()`. This path is **completely independent** of the Qwik render pipeline and is doing exactly what was intended.

**This means converting routes from `routeLoader$` to client-side fetching has zero impact on Discord/Twitter/Google link previews.** The metadata path stays untouched. The conversion only changes what real users see.

---

## 2. Principles

These rules define the target state. Every route decision below is derived from them.

1. **`routeLoader$` is banned for bulk/dynamic data.** Any data that comes from the backend GraphQL API must be fetched from the browser via `useResource$` (or equivalent client-side primitives), not from the Qwik server render.

2. **`routeLoader$` is permitted only for:**
   - Static local files shipped with the deployment (e.g., markdown guides under `public/guides/`)
   - Route parameter parsing / redirects that do not involve network calls
   - Small config lookups from hard-coded maps (e.g., `getGuideBySlug()`)

3. **The crawler metadata path in `entry.fastify.tsx` is the only place that renders page-specific content server-side**, and it only renders `<meta>` tags for bots.

4. **Every client-fetched route must have a loading state** that matches the final layout closely enough to avoid layout shift (CLS) and visual jank.

5. **Every client-fetched route must have an error state** (network failure, 404, backend down) that is distinguishable from the loading state.

6. **`VITE_API_URL` must resolve to a public, browser-reachable URL in every environment.** Internal-only hostnames (e.g., `http://backend:3001`) are forbidden because the client will be calling them directly.

7. **One route, one commit.** Each route conversion is its own commit with a descriptive message. No batching.

---

## 2.5 Execution update (2026-04-07)

During execution, two additional routes previously flagged as "already correct SPA" in §3 were found to have the same SSR leak as the stats routes. Both use `useResource$` with no SSR guard, so their HTML responses contain full unit data.

Fix: same `useSignal + useVisibleTask$` pattern as the stats routes. Both routes now converted.

| Route | Status |
|---|---|
| `arsenal/[unitid]` | **Converted** — uses single `useVisibleTask$` for the unit fetch, reuses the existing two tasks for URL param sync |
| `arsenal/compare` | **Converted** — two `useVisibleTask$` blocks, one for the arsenal card list, one for the compared-pair fetch |

Lesson: **if a route's HTML response contains any content that isn't from a local static file or the component's own layout/chrome, it's SSR'ing data and needs conversion** — regardless of whether it uses `routeLoader$` or `useResource$`. Both primitives resolve server-side in Qwik City SSR.

One caveat discovered during testing: after swapping `useResource$ → useVisibleTask$` in the dev server, Vite's HMR cache served stale compiled chunks and the new tasks never fired in the browser. Verification gave misleading "no GraphQL calls in Network" results until the dev server was restarted. **Restart Vite after this kind of primitive swap.**

## 3. Current state — full route inventory

Every route file under `frontend/src/routes/` classified by its current data-fetching posture. "SSR data" = the route currently ships bulk data inside the initial HTML response via `routeLoader$`.

| # | Route file | Current posture | Uses `routeLoader$`? | Data source | Conversion target |
|---|---|---|---|---|---|
| 1 | `index.tsx` (home) | Pure static shell | No | None | **No change** |
| 2 | `layout.tsx` (root layout) | Pure static shell + nav | No | None | **No change** |
| 3 | `arsenal/index.tsx` | **SSR data** | `useArsenalData` (1 query: full unit list) | GraphQL | **Convert to `useResource$`** |
| 4 | `arsenal/[unitid]/index.tsx` | **SSR data (hidden)** ← originally mislabeled | No `routeLoader$` but `useResource$` leaks | GraphQL | **Converted** (see §2.5) |
| 5 | `arsenal/compare/index.tsx` | **SSR data (hidden)** ← originally mislabeled | No `routeLoader$` but `useResource$` leaks | GraphQL | **Converted** (see §2.5) |
| 6 | `stats/index.tsx` | **SSR data** | `useStatsOverview` (6 queries) | GraphQL | **Convert to `useResource$`** |
| 7 | `stats/player/[steamId]/index.tsx` | **SSR data** | `usePlayerProfile` (2 queries) | GraphQL | **Convert to `useResource$`** |
| 8 | `stats/match/[fightId]/index.tsx` | **SSR data** | `useFightData` (1 query) | GraphQL | **Convert to `useResource$`** |
| 9 | `maps/index.tsx` | Already SPA | No | Client-side fetch on user action | **No change** — already correct |
| 10 | `guides/index.tsx` | Pure static shell | No | Hard-coded config | **No change** |
| 11 | `guides/[slug]/index.tsx` | SSR content | `useGuideContent` (reads local `.md` file) | Local file, not backend | **Leave as-is** (permitted per Principle 2) |
| 12 | `decks/index.tsx` | Pure static shell | No | None | **No change** |
| 13 | `decks/browse/index.tsx` | Already SPA | No | GraphQL client-side | **No change** — already correct |
| 14 | `decks/browse/[id]/index.tsx` | Already SPA | No | GraphQL client-side | **No change** — already correct |
| 15 | `decks/builder/index.tsx` | Already SPA | No | localStorage + GraphQL | **No change** — already correct |
| 16 | `decks/builder/new/index.tsx` | Already SPA | No | localStorage + GraphQL | **No change** — already correct |
| 17 | `decks/builder/edit/[deckId]/index.tsx` | Already SPA | No | localStorage + GraphQL | **No change** — already correct |
| 18 | `sys/index.tsx` (admin) | Already SPA | No | `/admin/*` REST API | **No change** — already correct |

**Summary:**
- **4 routes need conversion:** arsenal index, stats index, player detail, match detail
- **1 route stays SSR (permitted):** guide viewer (local file content)
- **13 routes already match the target state** and are left untouched

### 3.1 Impact of current SSR on page weight

| Route | HTML response size estimate | Data items leaked |
|---|---|---|
| `stats/index.tsx` | Large — 6 queries worth of 30-day time series + top-100 unit perf | Meta-game leaderboard |
| `stats/player/[steamId]/index.tsx` | Large — profile + 45 recent fights + unit usage | Per-player data |
| `stats/match/[fightId]/index.tsx` | Large — entire fight detail | Per-match data |
| `arsenal/index.tsx` | Very large — every unit in the game | Static game data (already public) |

The stats routes are the highest-value scraping targets. The arsenal route is the weakest case for conversion (data is already public and changes only with game patches) but is included for uniformity.

---

## 4. Target state

After this plan is complete:

- A real user visiting any data-bearing route gets an HTML shell with loading skeletons, then GraphQL fetches become visible in DevTools as the page hydrates
- A bot visiting the same route gets the crawler metadata HTML from `entry.fastify.tsx`'s `onRequest` hook — no change to current behaviour
- The guide viewer is the only route that still SSRs bulk content, and that content is a local markdown file (not a backend API call)
- Every converted route has a loading skeleton and an error state
- `VITE_API_URL` is a public hostname reachable from browsers

---

## 5. Conversion pattern (canonical template)

Every conversion follows the same mechanical transform. This is the reference implementation — copy this shape for each route.

**⚠ Critical clarification (discovered during execution):** `useResource$` is NOT client-only. Qwik City SSR awaits its promises and embeds the resolved data in the HTML. To get actual client-only fetching — which is the whole point of this plan — you MUST use `useVisibleTask$` to trigger the fetch after hydration, storing the result in a signal. The template below reflects this corrected approach.

### 5.1 Before (current)

```tsx
import { component$ } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import type { PlayerData } from '~/lib/graphql-types';
import { STATS_USER_PROFILE_QUERY } from '~/lib/queries/stats';

export const usePlayerProfile = routeLoader$(async (requestEvent) => {
  const steamId = requestEvent.params.steamId;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: STATS_USER_PROFILE_QUERY,
      variables: { steamId },
    }),
  });
  const payload = await res.json();
  return payload.data?.analyticsUserProfile ?? null;
});

export default component$(() => {
  const data = usePlayerProfile();
  return <PlayerView profile={data.value} />;
});
```

### 5.2 After (target — client-only via useVisibleTask$)

```tsx
import { $, component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { useLocation } from '@builder.io/qwik-city';
import type { PlayerData } from '~/lib/graphql-types';
import { STATS_USER_PROFILE_QUERY } from '~/lib/queries/stats';
import { PlayerSkeleton } from '~/components/skeletons/PlayerSkeleton';
import { GenericErrorView } from '~/components/errors/GenericErrorView';

async function fetchPlayerProfile(steamId: string, signal: AbortSignal): Promise<PlayerData | null> {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: STATS_USER_PROFILE_QUERY,
      variables: { steamId },
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`);
  const payload = await res.json();
  return payload.data?.analyticsUserProfile ?? null;
}

export default component$(() => {
  const loc = useLocation();
  const data = useSignal<PlayerData | null>(null);
  const error = useSignal<unknown>(null);
  const refreshCounter = useSignal(0);

  // useVisibleTask$ NEVER runs on the server — this guarantees the fetch is
  // browser-only and the SSR response contains only the skeleton.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    const steamId = track(() => loc.params.steamId);
    track(() => refreshCounter.value);
    const abort = new AbortController();
    cleanup(() => abort.abort());
    data.value = null;
    error.value = null;
    fetchPlayerProfile(steamId, abort.signal)
      .then((result) => { data.value = result; })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        error.value = err;
      });
  });

  const retry$ = $(() => { refreshCounter.value++; });

  if (error.value) {
    return (
      <GenericErrorView
        titleKey="errors.playerLoadFailed"
        messageKey="errors.playerLoadMessage"
        error={error.value}
        retry$={retry$}
        backHref="/stats"
        backLabelKey="stats.player.backToStats"
      />
    );
  }
  if (!data.value) return <PlayerSkeleton />;
  return <PlayerContent data={data.value} />;
});
```

### 5.3 Key rules
- **Use `useVisibleTask$`, NOT `useResource$`.** `useResource$` runs during SSR and defeats the entire purpose of this conversion. `useVisibleTask$` is guaranteed to be browser-only.
- **Track route params inside the task.** Re-fetch when `steamId` / `fightId` / `unitid` changes (client-side navigation between different entities).
- **Abort controller.** Cancel in-flight requests via `cleanup()`. Prevents stale writes when the component unmounts or the tracked value changes.
- **Null-out before fetching.** Set `data.value = null` and `error.value = null` before kicking off a new fetch so the skeleton re-shows during param-change navigation.
- **Three states via conditional render.** `error.value` → error view. `!data.value` → skeleton. Otherwise → content. Don't collapse these into a single spinner.
- **Null vs empty vs error are different.** A successful response with no player found is `data.value !== null` with an empty profile (e.g., `{ profile: null }`). The error branch is reserved for network failures and 5xx.
- **Ignore `AbortError`.** When the task re-runs due to param change, the in-flight fetch aborts and throws `AbortError` — this is not a real error and should not populate `error.value`.
- **Retry pattern.** A `refreshCounter` signal tracked by the task, incremented by the retry callback, gives you a "refetch" handle without exposing internal task state.
- **Don't touch `DocumentHead` exports for bots.** Page titles and meta tags become static (or use route params like `params.steamId`). The crawler path in `entry.fastify.tsx` handles dynamic meta tags for bots independently.
- **Extract the fetch function.** Put the actual `fetch()` call in a top-level `async function` that takes `(params..., signal)`. Keeps the component body small and makes the task body obvious.

### 5.4 Why `useResource$` was rejected (learning)

During the initial implementation, all four routes were converted to `useResource$ + <Resource>`. The HTML responses were then verified in the running Vite dev server (which runs `vite --mode ssr`), and the player/ELO/K-D values were still fully present in the initial HTML. Investigation showed:

- Qwik City `useResource$` runs during server-side render
- The SSR pipeline awaits the resource's promise before flushing HTML
- `onResolved` is therefore rendered server-side in the common case
- There is no `ssrSkip` / `clientOnly` option on `useResource$` in Qwik 1.5

Attempted workaround: `if (isServer) { await new Promise(() => {}); }` inside the resource callback. This **hung the SSR pipeline** because Qwik awaits the promise indefinitely — timing out eventually or blocking the response entirely. Not viable.

Working solution: swap `useResource$` → `useSignal + useVisibleTask$`. `useVisibleTask$` is guaranteed browser-only by construction (it runs after the component is visible in the DOM), so the signal stays `null` during SSR and the skeleton branch is what gets streamed. The eslint rule `qwik/no-use-visible-task` warns against overusing this primitive because it defeats resumability; in this case that's **exactly what we want**, and the disable comment documents the intent.

---

## 6. Loading skeleton design

Each converted route needs a skeleton component that preserves layout dimensions to prevent CLS.

### 6.1 General skeleton conventions (new)
- Location: `frontend/src/components/skeletons/`
- Naming: `{Page}Skeleton.tsx` — one per converted route, no shared mega-component
- Use `bg-[rgba(36,36,36,0.4)]` for placeholder blocks
- Use existing panel patterns from `CLAUDE.md` — gradient panels, proper border opacity
- No animation required for v1 (can add `animate-pulse` later if desired)
- Match the final layout's grid/flex structure exactly so the page doesn't jump when data arrives

### 6.2 Per-route skeletons needed
| Route | Skeleton component | Layout to mirror |
|---|---|---|
| arsenal index | `ArsenalSkeleton` | Filter sidebar + unit card grid (~20 placeholder cards) |
| stats index | `StatsOverviewSkeleton` | 6 chart panels with placeholder canvas boxes |
| player detail | `PlayerDetailSkeleton` | Hero row + 6 stat cards + 2 chart cards + 4 unit lists |
| match detail | `MatchDetailSkeleton` | Match header + team rosters |

### 6.3 Error view conventions (new)
- Location: `frontend/src/components/errors/`
- Naming: `{Page}ErrorView.tsx` — can also be a single shared `GenericErrorView` if the content is minimal
- Content: error message (i18n key), retry button, "back to X" link
- i18n: add keys under `errors.*` in `en.ts`

---

## 7. Per-route conversion plan

Each route is its own work order with its own commit. Order is chosen to pilot on the smallest surface first and fan out.

### Order of operations
1. **Pilot:** `stats/player/[steamId]` (most important to prove the pattern, moderate size, clear scope)
2. **Pattern repeat:** `stats/match/[fightId]` (similar shape, smaller)
3. **Largest:** `stats/index.tsx` (6 queries, most intricate)
4. **Last:** `arsenal/index.tsx` (lowest value, highest perf cost, do after the pattern is proven)

### 7.1 Work order: player detail page

**File:** `frontend/src/routes/stats/player/[steamId]/index.tsx`

**Steps:**
1. Create `frontend/src/components/skeletons/PlayerDetailSkeleton.tsx` mirroring the hero row + stat grid + chart cards + unit lists layout
2. Create `frontend/src/components/errors/PlayerErrorView.tsx` (can be generic)
3. Add `errors.playerLoadFailed`, `errors.retry`, `errors.backToStats` keys to `en.ts`
4. In the route file:
   - Remove the `usePlayerProfile = routeLoader$(...)` export
   - Import `useResource$`, `Resource` from `@builder.io/qwik`
   - Move the two GraphQL fetches (`STATS_USER_PROFILE_QUERY`, `STATS_RECENT_FIGHTS_QUERY`) into a single `useResource$` inside the component
   - Track `loc.params.steamId` and wire an `AbortController`
   - Wrap the existing view JSX in `<Resource value={...} onPending={...} onRejected={...} onResolved={(data) => ...}>`
   - Refactor the component body to receive `data` as an argument to `onResolved` (may require splitting into a `PlayerView` subcomponent)
5. Type-check: `npx tsc --noEmit -p frontend/tsconfig.json`
6. Local test: `npm run dev -w frontend` → visit `/stats/player/{known-steamId}` → verify skeleton shows, then content, then DevTools Network shows the GraphQL calls
7. Commit: `Convert player detail page from SSR to client-side data fetching`

**Risks:**
- The player file is 1547 lines. The view logic that currently reads `data.value.profile`, `data.value.recentFights`, etc. will need to be refactored to receive `data` as a prop. This is the biggest part of the work.
- Recent-fights tab switching may need to be re-verified — ensure the tab state is not reset on re-fetch.

### 7.2 Work order: match detail page

**File:** `frontend/src/routes/stats/match/[fightId]/index.tsx`

**Steps:**
1. Create `frontend/src/components/skeletons/MatchDetailSkeleton.tsx`
2. Reuse or create `GenericErrorView`
3. Add `errors.matchLoadFailed` to `en.ts` (if not already generic)
4. Same conversion pattern as player page
5. Type-check + local test + commit

**Risks:** Lower than player page. One query, ~820 lines, simpler shape.

### 7.3 Work order: stats overview page

**File:** `frontend/src/routes/stats/index.tsx`

**Steps:**
1. Create `frontend/src/components/skeletons/StatsOverviewSkeleton.tsx` with 6 chart panel placeholders
2. Reuse generic error view
3. Add `errors.statsLoadFailed` to `en.ts`
4. Convert the `useStatsOverview = routeLoader$(...)` loader — which has **6 parallel GraphQL queries plus client-side chart config builders** — into a single `useResource$` returning the same shape
5. The chart config builder functions (lines 229, 266, 306, 355, 399, 489, 546) should stay as pure functions called from inside `useResource$` OR from `onResolved` — whichever keeps the data flow simplest
6. Type-check + local test + commit

**Risks:**
- Most complex conversion. 6 queries + several `track()` calls if the page has time-range selectors.
- Verify charts still render correctly after hydration (the `on:qvisible` path should still fire when the canvas scrolls into view).

### 7.4 Work order: arsenal page

**File:** `frontend/src/routes/arsenal/index.tsx`

**Steps:**
1. Create `frontend/src/components/skeletons/ArsenalSkeleton.tsx` with ~20 placeholder unit cards in the grid
2. Reuse generic error view
3. Convert `useArsenalData = routeLoader$(...)` to `useResource$`
4. Type-check + local test + commit

**Risks:**
- Initial paint will feel slower than before (noticeable — this page currently appears instantly because the full unit list is in the HTML)
- If this perf hit is unacceptable in practice, consider **reverting this one conversion only** and documenting it as an exception to Principle 1 on performance grounds (the data is already public static game data so the scraping concern is minimal)

---

## 8. Testing plan (local only, no prod deploy until final)

### 8.1 Prerequisites
- `npm run dev:db` (PostgreSQL in Docker)
- `npm run dev:migrate` (apply migrations)
- `npm run dev -w database` (REST service on :3002)
- `npm run dev -w backend` (GraphQL gateway on :3001)
- `npm run dev -w frontend` (Qwik dev server on :3000) — **this runs `vite --mode ssr` so the SSR pipeline is active locally**

### 8.2 Per-route verification checklist
After each conversion commit:

1. **Type-check clean:** `npx tsc --noEmit -p frontend/tsconfig.json` — no new errors
2. **Page loads:** visit the route in a real browser, not just headless
3. **HTML is empty of data:** View source (Ctrl+U) — the numeric/text data should NOT be in the initial HTML, only skeleton placeholders
4. **GraphQL is visible in DevTools:** Network tab → Fetch/XHR filter → see the POST to `/graphql` fire from the browser
5. **Skeleton → content transition:** Page first shows skeleton, then real content. No blank flash, no layout jump
6. **Error state works:** Stop the backend (`Ctrl+C` on `npm run dev -w backend`), reload the page, verify error view renders (not a raw stack trace)
7. **Re-fetch on navigation:** If the route has a dynamic parameter (e.g., player/match/unit), navigate between two different IDs and verify the new data loads
8. **Crawler preview still works:** `curl -H "User-Agent: Discordbot/2.0" http://localhost:3000/stats/player/{id}` should return the hand-rolled meta HTML, not the empty shell
9. **i18n:** Switch language in the UI (if applicable) and verify loading/error strings translate

### 8.3 Regression checks (run after each commit)
- Home page still loads
- Arsenal unit detail (`/arsenal/277`) still loads (already SPA, should be unaffected)
- Deck browser still loads
- Admin `/sys` page still works (uses a different API path)
- Guide viewer (`/guides/{slug}`) still renders markdown content from the SSR loader (still permitted)

### 8.4 No deploy until final
Do not deploy any of these commits until all 4 conversions are done and tested locally. Deploy as a single batch when the full plan is complete.

---

## 9. Rollback plan

Each conversion is one commit. To roll back:

1. Identify the problem commit via `git log` on `main`
2. `git revert <sha>` — creates a new commit undoing the conversion
3. Re-deploy

**Do not rewrite history on `main`.** Revert commits only.

If a conversion introduces a production issue that isn't immediately obvious, the crawler metadata path is unaffected (so Discord previews keep working) and the rest of the site (13 untouched routes) keeps working. Blast radius is bounded to the converted route.

---

## 10. Environment variable verification

### 10.1 Before starting
Check the following across environments:

| Env | `VITE_API_URL` | Must be browser-reachable? |
|---|---|---|
| Local dev | `http://localhost:3001/graphql` | Yes (same machine) |
| Staging (if any) | Public URL | Yes |
| Production (`main` on VPS) | Public URL | **Yes — verify before deploy** |

### 10.2 The trap
`VITE_API_URL` is currently used by both SSR (`routeLoader$`) and client (`useResource$` in arsenal detail, decks, maps, etc.). Because Vite prefixes `VITE_*` vars are **baked into the client bundle at build time**, this already has to be a public URL for the client-side callers to work. That means the value is **already correct** — if existing client-side fetches from `arsenal/[unitid]` work in production, then the converted routes will work too.

### 10.3 The `INTERNAL_API_URL` red herring
`frontend/.env.example` declares `INTERNAL_API_URL=http://backend:3001/graphql` but **no code reads this variable**. It's a leftover. Can be deleted in a follow-up cleanup commit — not blocking for this plan.

---

## 11. Out of scope for this plan

These are adjacent concerns that should NOT be addressed as part of the SSR→SPA conversion. Track them separately.

- **Rate limiting on `/stats/*` routes.** Separate infra-level decision (Cloudflare, nginx, Fastify plugin). The SSR→SPA work adds friction to scraping but is not a substitute for rate limits.
- **The stats rework replan on `dev`.** The `dev` branch is in limbo per user direction. If/when the stats system is rebuilt, this plan's principles should be baked in from the start so the rebuild doesn't reintroduce `routeLoader$` for data.
- **Orphaned stats files.** On `dev` there are orphaned `stats.ts` queries and `ChartCanvas.tsx` per `CLAUDE.md`. Not relevant on `main`.
- **Deck builder, maps, admin panel, arsenal detail.** Already client-side. Leave alone.
- **Removing `INTERNAL_API_URL` from `.env.example`.** Minor cleanup, separate commit if done at all.
- **CLS prevention beyond skeleton layout matching.** If individual converted routes have CLS issues, address per-route — not in this plan.

---

## 12. Open questions (decide before work starts)

1. **Should the error view be a single shared component (`GenericErrorView`) or per-route?** Recommendation: single shared component that takes `title`, `message`, `retryHref` props. Faster to build, easier to style consistently.

2. **Should skeletons use `animate-pulse`?** Recommendation: no for v1, yes in a follow-up if pages feel too static. Keep the first pass minimal.

3. **For the arsenal page specifically, is the perf hit acceptable?** If SSR'd: page is instant. If converted: skeleton flash + 1 round trip. Decision point — can defer until after the stats conversions land and we see how it feels on slower connections.

4. **Should a successful response with `profile: null` (player not found) render via `onResolved` + null check, or via `onRejected` with a thrown error?** Recommendation: `onResolved` + null check. 404s are not errors, they're a valid resolved state.

5. **Do we want a retry button on the error view, or just reload-page instructions?** Recommendation: retry button that re-triggers the resource. Uses `useSignal` + a refresh counter tracked inside `useResource$`.

6. **After conversion, should the arsenal index page cache the unit list in `sessionStorage`?** The unit list almost never changes. A tiny client-side cache would make the second visit instant and completely erase the perf regression. Recommendation: defer to a follow-up commit if users notice.

---

## 13. Success criteria

The plan is complete when:

- [ ] 4 routes converted, 4 commits on `main`
- [ ] Type-check passes on all three workspaces
- [ ] Local manual test passes the per-route checklist for all 4 routes
- [ ] View-source on each converted route shows skeleton HTML, not data
- [ ] DevTools Network shows GraphQL POSTs fired from the browser on each converted route
- [ ] Discord preview still works (`curl -H "User-Agent: Discordbot/2.0" ...` returns meta HTML)
- [ ] All 13 untouched routes still work (regression checklist)
- [ ] Plan document (this file) updated with any decisions made during execution, or a follow-up ADR is written

---

## 14. Reviewer notes

Before signing off on this plan, answer:

1. Does the scope (these 4 routes, not more, not less) match your intent?
2. Are the open questions in §12 answered, or deferred to execution?
3. Is the order of operations in §7 acceptable?
4. Is anyone else touching the same files on `main` right now? (Check `git log --oneline -20` and outstanding PRs.)
5. Are you OK with a temporary perf regression on the arsenal index page, or should that one be excluded?

---

## 15. Post-mortem: the SPA conversion was wrong, reverted to encrypted SSR

**Date:** 2026-04-08

### What happened

The SPA conversion shipped and worked as designed, but it came at a real perf cost — every page now has a skeleton-flash + GraphQL-RTT wait where there used to be instant content. That trade bought one thing: scraping friction against `curl | pup`. It bought nothing against a headless-browser scraper.

Meanwhile an adjacent piece of work had been quietly happening in parallel:

1. `shared/src/crypto.ts` implemented `encryptPayload` / `decryptPayload` / `isEncryptionConfigured` using AES-256-CBC over crypto-js (mirroring the legacy REST project's pattern)
2. `backend/src/index.ts` wired in opportunistic pre/onSend hooks that decrypt `{e: ciphertext}` request bodies and encrypt responses when the request was tagged
3. `frontend/src/lib/graphqlClient.ts` shipped a `graphqlFetch` / `graphqlFetchRaw` helper that transparently handles the envelope
4. `docker-compose` and the deploy workflow already piped `ENCRYPTION_KEY` / `VITE_ENCRYPTION_KEY` through as env vars
5. A later commit (`83aeaf5`) migrated all 46 inline GraphQL call sites in the frontend to go through `graphqlFetch`, so enabling wire encryption became a single env-var flip

None of that helped the SPA perf regression. Wire encryption on the localhost hop between frontend SSR and backend is pointless for anti-scrape because the HTML response still exposed data the moment you reverted the SPA change. And the SPA change was what gave up the perf in the first place.

### The fix — encrypted SSR envelope

Option B from the thread: put the `routeLoader$` back, but instead of returning plain `StatsPageData`, return a discriminated union envelope:

```typescript
type Envelope =
  | { cipher: string; plain?: undefined }    // prod: encrypted blob
  | { cipher?: undefined; plain: PageData }; // dev without keys: plain

export const usePageData = routeLoader$<Envelope>(async () => {
  const data = await fetchFromGraphQL();
  if (isEncryptionConfigured()) return { cipher: encryptPayload(data) };
  return { plain: data };
});

export default component$(() => {
  const envelope = usePageData();
  const data = useSignal<PageData | null>(null);

  useVisibleTask$(
    ({ track }) => {
      const v = track(() => envelope.value);
      data.value = v.cipher !== undefined
        ? decryptPayload<PageData>(v.cipher)
        : v.plain;
    },
    { strategy: 'document-ready' },
  );

  if (!data.value) return <PageSkeleton />;
  return <PageContent data={data.value} />;
});
```

Qwik serializes the envelope (not the decrypted data) into the q:state blob in the HTML. Scrapers running `curl /stats/player/{id}` see the skeleton markup and a ciphertext string — no player name, ELO, K/D, match list, or unit stats. On hydration, the `useVisibleTask$` with `{ strategy: 'document-ready' }` fires immediately after Qwik resumes, decrypts once, and renders the real content without any network round-trip.

### Trade-off recap

| | Original SSR (unencrypted) | SPA (useVisibleTask$ + client fetch) | Encrypted SSR (this fix) |
|---|---|---|---|
| First paint | Instant | Skeleton flash | Instant skeleton, content <100ms later |
| Scrape `curl`? | ✗ Full data | ✓ Empty shell | ✓ Cipher blob only |
| Scrape headless browser? | ✗ Full data | ✗ Full data | ✗ Full data (key in bundle) |
| Extra network RTT after paint | 0 | 1 | 0 |
| Server CPU cost | baseline | baseline | +~0.1ms AES per request |

Encrypted SSR defeats the same attackers the SPA pattern defeated (laziest `curl | grep` bots) while restoring the paint timing. Anyone with a real browser + devtools can still extract `VITE_ENCRYPTION_KEY` from the client bundle and decrypt — which is fine, because that's the same threat model the legacy REST project accepted.

### What was converted back

| Route | Commit |
|---|---|
| `stats/player/[steamId]/index.tsx` | `6c2fdb5` Re-SSR player detail page with encrypted envelope |
| `stats/match/[fightId]/index.tsx` | `723fe17` Re-SSR match detail page with encrypted envelope |
| `stats/index.tsx` (stats overview) | `ef96004` Re-SSR stats overview page with encrypted envelope |
| `arsenal/index.tsx` | `573261e` Re-SSR arsenal listing page with encrypted envelope |

Verified against the running local dev server with `ENCRYPT_API=true` and matching `ENCRYPTION_KEY`/`VITE_ENCRYPTION_KEY`:
- All 4 `curl` responses contain a `{"cipher":"..."}` blob in q:state and no leaked data
- All 4 pages render full content after hydration in a real browser
- Dev-loop still works with `ENCRYPTION_KEY` unset — falls back to `{plain: data}`
- Crawler metadata path in `entry.fastify.tsx` is unaffected (bots still get their own hand-rolled meta HTML before the Qwik render runs)

### What's still SPA (and why that's fine)

- `arsenal/[unitid]/index.tsx` and `arsenal/compare/index.tsx` remain client-fetched via `graphqlFetch`. They have genuinely interactive re-fetches (swapping modifications, picking different comparison units) that don't fit the `routeLoader$` model. Their wire traffic is encrypted via the opportunistic backend hook.
- Every other route in §3's inventory that was already client-side stays client-side.

### Things I'd do differently

- **Don't trade perf for a half-wall.** The first plan weighed scraping friction against perf and picked friction. That was wrong given we also had a near-finished encryption layer sitting in shared/ that would have given us both. I should have noticed the unused crypto infra before committing to the SPA conversion.
- **Verify the scrape attack you're defending against is real.** If the only attacker is `curl | pup`, you might not need any of this — rate limits on the edge would be cheaper. If the attacker is a well-resourced team running real browsers, nothing short of auth helps.
- **Respect `document-ready` as a strategy option.** The default `intersection-observer` for `useVisibleTask$` delays execution until the element is on-screen, which is fine for below-the-fold widgets but wrong for above-the-fold data decryption. Use `{ strategy: 'document-ready' }` when you want the task to run immediately after Qwik resumes.
- **Use a discriminated envelope, not a single field that might be null.** `{cipher: string} | {plain: T}` with exclusive `undefined` on the missing side type-checks cleanly and avoids the "is this encrypted or not?" runtime guesswork.
