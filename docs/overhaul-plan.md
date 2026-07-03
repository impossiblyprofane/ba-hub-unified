# Overhaul Plan

**Status:** Phases 1–5 executed 2026-07-03 (see ✅ markers); Phase 6 is ongoing follow-up work
**Decision:** prod deploys via `v*` version tags (chosen over manual dispatch)
**Last updated:** 2026-07-03
**Prepared from:** full branch audit + repo-health survey + fresh-clone verification

---

## 0. Ground truth (verified on a fresh clone, 2026-07-03)

| Check | Result |
|---|---|
| `npm run build` (all 4 workspaces) | ✅ passes — one warning: duplicate `dangerouslySetInnerHTML` key in `frontend/src/components/RouterHead.tsx` |
| `npm run test` | ✅ 9 backend + 55 frontend tests pass (vitest prints a harmless teardown error after the frontend run) |
| `npm run type-check` | ⚠️ **fails on a fresh clone** — passes only after `npm run build -w shared`. The root script doesn't build shared first (the CI workflow does; the local script doesn't). |

The codebase itself is healthy. The mess is in **branches, dead duplicates, junk files, stale docs, and config sprawl** — not in the shipped code.

---

## 1. Branch audit & dispositions (done 2026-07-03)

| Branch | State found | Disposition |
|---|---|---|
| `master` | Default branch, active dev mainline, tip `a7e73fe` (2026-05-05) | Keep — mainline |
| `main` | **Ahead of master by 3** finished deploy fixes (`deploy.yml` ghost-file fix + container log caps, `docker-compose.prod.yml`). Production deploy trigger. | ✅ **Wrapped up** — fast-forwarded into `claude/project-status-overview-0gokkl`; reaches master when that branch merges. Keep `main` itself until §3 (deploy model) is decided — deploys fire from it. |
| `dev` | 0 unique commits, 17 behind master. Docs call it "in limbo, do not use" — but it is the **dev-environment deploy trigger** in `deploy.yml`. | Keep until §3 is decided, then delete. |
| `refactor/analytics` (`4e322bf`) | Abandoned 2026-04-05 experiment: removes the entire crawler/stats system (−13,512 lines) "for clean analytics redesign". Master kept and improved that system instead. Superseded. | ❌ **Discard** (see commands below) |
| `claude/refactor-cicd-deployment-JSUbq` (`5a8df84`) | Abandoned 2026-04-05: a stats/DB rework master never took, entangled with a CI/CD refactor. One salvageable idea: `.github/workflows/ci.yml` (test-running CI gate) — see §3. | ❌ **Discard** after salvaging `ci.yml` (see commands below) |

**Discard commands** — remote ref changes (tag pushes, branch deletion) are blocked from the automation environment, so run these locally:

```bash
# Safety net first: archive tags so the SHAs stay reachable forever
git fetch origin refactor/analytics claude/refactor-cicd-deployment-JSUbq
git tag archive/refactor-analytics 4e322bf6e9b05522ab1da09bdb0cce73e3e32e74
git tag archive/refactor-cicd-deployment 5a8df84755861da38c2b9666220d43c85ed80183
git push origin archive/refactor-analytics archive/refactor-cicd-deployment

# Then delete the dead branches
git push origin --delete refactor/analytics claude/refactor-cicd-deployment-JSUbq
```

---

## 2. Phase 1 — Repo hygiene ✅ (executed)

- Delete committed junk:
  - `out.json` (**12 MB** data dump at repo root — also shipped to the server on every deploy)
  - `lb100.json` (leaderboard dump)
  - `frontend/tsconfig.tsbuildinfo` (TS incremental build artifact)
  - `backend/doc/` (**4.5 MB** vendored Swagger-UI bundle + data dumps; no `@fastify/swagger` registration exists — nothing serves it)
  - `shared/src/legacy/` (empty placeholder scaffolding)
  - `scripts/build.js`, `scripts/setup.js`, `scripts/db-viewer.html` (referenced by nothing; `build.js` is also wrong — it omits the `database` workspace)
- Extend the 8-line `.gitignore`: `*.tsbuildinfo`, `out.json`, `lb100.json`, and resolve the contradiction that `.github/copilot-instructions.md` is both committed **and** gitignored.
- Add `out.json`/`lb100.json` to `.dockerignore` (until deleted).

## 3. Phase 2 — One mainline, one deploy story ✅ (executed — tag-based prod)

Today: development happens on `master` (default), but deploys trigger on pushes to `main` (prod) and `dev` (dev env). Result: the recurring "Merge main into master / master into main" dance, a stale `dev`, and a quality gate (`type-check.yml`) that **only runs on PRs to main/dev — i.e. effectively never**, while deploys run zero checks.

**Implemented model** (prod via version tags, per owner decision):

1. ✅ `master` is the only long-lived branch.
2. ✅ `deploy.yml`: push to `master` → auto-deploy the **dev** environment; push a **`v*` tag** → deploy **production**. Release = `git tag v3.x.y && git push origin v3.x.y`.
3. ✅ CI gate added as `.github/workflows/ci.yml` (npm ci → build shared → type-check → test), run as a `workflow_call` prerequisite job in `deploy.yml` and on PRs to master. The Postgres service container from the archived branch was dropped — no current test touches a DB; re-add it when database tests exist. `type-check.yml` folded in and deleted.
4. ⬜ **Remaining (owner action): delete `main` and `dev` once this lands on master** — their old deploy.yml stays live until they're gone:
   ```bash
   git push origin --delete main dev
   ```
5. ✅ Script fixes: root `type-check` builds shared first; `dev:setup`'s Windows-only `timeout /t 3` replaced with a portable node sleep; `docker:*` scripts moved to docker compose v2.

## 4. Phase 3 — Delete the dead duplicates ✅ (executed; table audit still open)

- **`frontend/server/` (entire directory) + the `serve` npm script.** The live production entry is `frontend/src/entry.fastify.tsx` (Docker CMD runs `dist/server/entry.fastify.js`). `frontend/server/meta/*` is an older, diverging copy of `frontend/src/lib/meta/*` (missing `guide.ts`, `robots.ts`, `sitemap.ts`, `structured-data.ts`). Nothing references it.
- `database/src/schema/unit-popularity-snapshots.ts` — not exported, referenced nowhere, table superseded by migration `0004_unit_performance_redesign.sql`.
- `INTERNAL_API_URL` in `frontend/.env.example` — read by no code (the SSR plan §10.3 documents this).
- ⬜ **Larger audit (still open, schedule separately):** the crawler/stats subsystem is *live*, but two generations of tables coexist — older periodic snapshots (`snapshots.ts`: `statSnapshots`, leaderboard/map/faction/unit snapshots) alongside newer crawler-derived tables (`crawler.ts`: match results/picks/deployments, spec/unit-performance snapshots). Audit which old tables are still read and retire the rest with a migration.

## 5. Phase 4 — Make the docs tell the truth ✅ (executed)

- **Create `CLAUDE.md` and un-ignore it.** It's cited as "single source of truth" by `README.md:160`, `docs/development.md` (3 places, with anchor links), and `docs/ssr-to-spa-plan.md` — yet it doesn't exist (and is gitignored). Content: architecture map, env-var table (see §6), deploy model from §3, conventions.
- Fix wrong file references: `docs/development.md` and `.github/copilot-instructions.md` point maintainers at the dead `frontend/server/index.ts` as "the production server" — the real one is `frontend/src/entry.fastify.tsx`. `development.md` also references a nonexistent `backend/src/graphql/graphql-types.ts`.
- `docs/development.md` still describes the SSR→SPA conversion as in-flight — it's done (plan doc header now marked ✅ Complete).
- Refresh `.github/copilot-instructions.md` (stale architecture claims) once its committed-vs-ignored status is resolved.

## 6. Phase 5 — Config & env rationalization ✅ (executed; root compose renamed to docker-compose.local.yml)

- **Two unrelated files named `docker-compose.dev.yml`:** root (local Postgres only, port 5432) vs `docker/` (full 3-service stack on 31xx ports whose "dev" DB points at **`bahub-prod-postgres`** via an external network — a foot-gun). Rename the `docker/` one (e.g. `docker-compose.staging.yml`) and document both.
- **API-URL sprawl:** client uses `VITE_API_URL` (baked at build); the server-side meta fetch reads `API_URL`, which is set only in the docker compose files and silently falls back to `http://localhost:3001/graphql` everywhere else. Document both in `.env.example`s; remove or log the localhost fallbacks (`frontend/src/lib/meta/utils/graphql.ts`, `frontend/src/lib/maps/sessionManager.ts`).
- Complete `backend/.env.example` — missing `DATABASE_SERVICE_URL`, `ADMIN_TOKEN`, `DB_ADMIN_SECRET`, `DB_ADMIN_ORIGINS`, `STEAM_API_KEY`, `STATS_COLLECTION_ENABLED`, `ENCRYPT_API`, all `CRAWLER_*`.
- Add `database/.env.example` (the only service without one); move the hardcoded CORS origins in `database/src/index.ts:18` to env.

## 7. Phase 6 — Code quality (incremental, opportunistic)

- ✅ Fix the `RouterHead.tsx` duplicate `dangerouslySetInnerHTML` build warning.
- Dedupe `SteamProfile` (defined in both `shared/src/types/steam-profile.ts` and `frontend/src/lib/graphql-types.ts:751`); longer-term, rationalize the shared-vs-frontend type split (a "unit" currently has ≥4 shapes).
- **Tests where they matter most:** the `database` workspace has zero tests and isn't even in the root `test` script — yet it holds the security-critical deck-ownership/challenge logic. Add a `test` script + ownership/challenge tests first; GraphQL resolver tests second.
- Split the giants when next touched (don't do a big-bang refactor): `backend/src/graphql/resolvers.ts` (2,236 lines), `frontend/src/lib/maps/canvasManager.ts` (1,932), `stats/player/[steamId]/index.tsx` (1,593), `backend/src/graphql/schema.ts` (1,090), `stats/index.tsx` (1,057).
- Naming-convention unification (kebab vs camel per directory) — lowest priority.

---

## Suggested order & effort

| Phase | Effort | Blocked on |
|---|---|---|
| 1 — Hygiene | ~1 hour | nothing |
| 2 — Mainline + CI/deploy | ~half day | **one decision: prod deploy via manual dispatch or `v*` tag** (recommended: dispatch) |
| 3 — Dead code | ~1 hour (+ separate table audit) | nothing |
| 4 — Docs | ~2 hours | Phase 2 decision (docs should describe the new model) |
| 5 — Config/env | ~2 hours | nothing |
| 6 — Code quality | ongoing | nothing |
