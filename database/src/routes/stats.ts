import type { FastifyInstance } from 'fastify';
import type { StatsClient, RestUserInfo, PlayerStats } from '../services/statsClient.js';
import type { TtlCache } from '../services/cache.js';
import { db } from '../db.js';
import { fightData } from '../schema/index.js';
import { eq } from 'drizzle-orm';

// ── Stats proxy routes ──────────────────────────────────────────
// Expose the external game API through the database service REST API.
// The backend (and any other consumer) calls these instead of hitting
// the external API directly.
//
// High-traffic endpoints (fight data, user lookups, recent fight IDs)
// are backed by in-memory TTL caches to absorb repeat requests without
// hitting the external game API again.

export async function registerStatsRoutes(app: FastifyInstance) {
  const statsClient: StatsClient = (app as any).statsClient;
  const userCache: TtlCache<RestUserInfo | null> = (app as any).userCache;
  const recentFightsCache: TtlCache<string[]> = (app as any).recentFightsCache;
  const playerStatsCache: TtlCache<PlayerStats | null> = (app as any).playerStatsCache;

  // ── Map data ──────────────────────────────────────────────────

  app.get('/map-ratings', async () => {
    try {
      return await statsClient.getMapRatings();
    } catch {
      return [];
    }
  });

  app.get('/map-team-sides', async () => {
    try {
      return await statsClient.getMapTeamSides();
    } catch {
      return { updateDate: null, data: [] };
    }
  });

  // ── Spec / faction data ───────────────────────────────────────

  app.get('/spec-usage', async () => {
    try {
      return await statsClient.getSpecUsage();
    } catch {
      return [];
    }
  });

  app.get('/country-stats', async () => {
    try {
      return await statsClient.getCountryStats();
    } catch {
      return { updateDate: null, matchesCount: [], winsCount: [] };
    }
  });

  // ── Leaderboard ───────────────────────────────────────────────

  app.get<{
    Querystring: { start?: string; end?: string };
  }>('/leaderboard', async (req) => {
    const start = Number(req.query.start) || 0;
    const end = Number(req.query.end) || 100;
    try {
      return await statsClient.getLeaderboard(start, end);
    } catch {
      return [];
    }
  });

  // ── User lookups ──────────────────────────────────────────────

  app.get<{
    Params: { id: string };
    Querystring: { steam?: string; market?: string };
  }>('/user/:id', async (req) => {
    const opts = {
      steam: req.query.steam === 'true',
      market: req.query.market === 'true',
    };
    const cacheKey = `${req.params.id}:${opts.steam}:${opts.market}`;
    const cached = userCache.get(cacheKey);
    if (cached !== undefined) return cached;
    try {
      const result = await statsClient.getUserById(req.params.id, opts) ?? null;
      userCache.set(cacheKey, result);
      return result;
    } catch {
      return null;
    }
  });

  app.post<{
    Body: { ids: number[] };
  }>('/users-by-ids', async (req) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) return {};
    try {
      const map = await statsClient.getUsersByIds(ids);
      // Convert Map to plain object for JSON serialization
      const result: Record<number, unknown> = {};
      for (const [k, v] of map) result[k] = v;
      return result;
    } catch {
      return {};
    }
  });

  // ── Player stats ──────────────────────────────────────────────

  app.get<{
    Params: { marketId: string };
  }>('/player-stats/:marketId', async (req) => {
    const key = req.params.marketId;
    const cached = playerStatsCache.get(key);
    if (cached !== undefined) return cached;
    try {
      const result = await statsClient.getPlayerStats(key) ?? null;
      playerStatsCache.set(key, result);
      return result;
    } catch {
      return null;
    }
  });

  // ── Batch player stats (avoids N+1 from leaderboard resolver) ─

  app.post<{
    Body: { marketIds: string[] };
  }>('/player-stats-batch', async (req) => {
    const marketIds = req.body?.marketIds;
    if (!Array.isArray(marketIds) || marketIds.length === 0) return {};

    // Cap at 150 to prevent abuse
    const ids = marketIds.slice(0, 150);
    const result: Record<string, PlayerStats | null> = {};

    // Separate cache hits from misses
    const misses: string[] = [];
    for (const id of ids) {
      const cached = playerStatsCache.get(id);
      if (cached !== undefined) {
        result[id] = cached;
      } else {
        misses.push(id);
      }
    }

    // Fetch misses in parallel with concurrency limit
    if (misses.length > 0) {
      const CONCURRENCY = 10;
      for (let i = 0; i < misses.length; i += CONCURRENCY) {
        const chunk = misses.slice(i, i + CONCURRENCY);
        const settled = await Promise.allSettled(
          chunk.map(async (id) => {
            const stats = await statsClient.getPlayerStats(id) ?? null;
            playerStatsCache.set(id, stats);
            return { id, stats };
          }),
        );
        for (const r of settled) {
          if (r.status === 'fulfilled') {
            result[r.value.id] = r.value.stats;
          }
        }
      }
    }

    return result;
  });

  // ── Fight data ────────────────────────────────────────────────

  app.get<{
    Params: { userId: string };
  }>('/recent-fights/:userId', async (req) => {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) return [];
    const cacheKey = String(userId);
    const cached = recentFightsCache.get(cacheKey);
    if (cached !== undefined) return cached;
    try {
      const result = await statsClient.getRecentFightIds(userId);
      recentFightsCache.set(cacheKey, result);
      return result;
    } catch {
      return [];
    }
  });

  app.get<{
    Params: { fightId: string };
  }>('/fight/:fightId', async (req) => {
    const id = Number(req.params.fightId);
    if (!Number.isFinite(id)) return null;

    // 1. Check PostgreSQL (fight_data table)
    try {
      const [row] = await db
        .select({ data: fightData.data })
        .from(fightData)
        .where(eq(fightData.fightId, id))
        .limit(1);
      if (row) return row.data;
    } catch { /* fall through to S3 */ }

    // 2. Fallback: fetch from S3 and write-through to DB
    try {
      const result = await statsClient.getFightData(req.params.fightId);
      if (!result) return null;
      // Write-through — persist the blob for future requests
      try {
        await db.insert(fightData).values({
          fightId: id,
          data: result as unknown as Record<string, unknown>,
          endTime: result.endTime,
        }).onConflictDoNothing({ target: fightData.fightId });
      } catch { /* non-critical — best-effort persist */ }
      return result;
    } catch {
      return null;
    }
  });

  // ── Cache diagnostics ───────────────────────────────────────────

  app.get('/cache-stats', async () => {
    return {
      users: userCache.stats(),
      recentFights: recentFightsCache.stats(),
      playerStats: playerStatsCache.stats(),
    };
  });
}
