import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import {
  crawlerState,
  processedMatches,
  matchTeamResults,
  matchPlayerPicks,
  matchUnitDeployments,
} from '../schema/index.js';
import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { parseSinceToEpochSec } from '../utils.js';

// ── Simple TTL cache ────────────────────────────────────────
// Caches expensive query results for a configurable duration.

const cache = new Map<string, { data: unknown; expires: number }>();

function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) {
    return Promise.resolve(entry.data as T);
  }
  return fn().then((data) => {
    cache.set(key, { data, expires: Date.now() + ttlMs });
    return data;
  });
}

const CACHE_5MIN = 5 * 60 * 1000;
const CACHE_15MIN = 15 * 60 * 1000;

// ── Types ────────────────────────────────────────────────────────

interface CrawlerStateUpdate {
  scanFloor?: number;
  scanCeiling?: number;
  scanPosition?: number;
  initialCollectionDone?: boolean;
}

interface MatchTeamInput {
  teamId: number;
  factionName: string;
  isWinner: boolean;
  avgRating?: number;
}

interface MatchPlayerPickInput {
  steamId?: string;
  odId?: number;
  teamId?: number;
  spec1Id?: number;
  spec1Name?: string;
  spec2Id?: number;
  spec2Name?: string;
  factionName: string;
  oldRating?: number;
  newRating?: number;
  destruction?: number;
  losses?: number;
  damageDealt?: number;
  damageReceived?: number;
  objectivesCaptured?: number;
}

interface MatchUnitDeployInput {
  steamId?: string;
  odId?: number;
  unitId: number;
  unitName: string;
  factionName: string;
  optionIds: string;
  configKey: string;
  playerRating?: number;
  eloBracket: string;
  killedCount: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  supplyPointsConsumed: number;
  wasRefunded: boolean;
}

interface MatchInsert {
  fightId: number;
  mapId?: number;
  mapName?: string;
  isRanked: boolean;
  winnerTeam?: number;
  playerCount: number;
  totalPlayTimeSec?: number;
  endTime?: number;
  teams?: MatchTeamInput[];
  playerPicks?: MatchPlayerPickInput[];
  unitDeployments?: MatchUnitDeployInput[];
}

// ── Routes ───────────────────────────────────────────────────────

export async function registerCrawlerRoutes(app: FastifyInstance) {
  /**
   * GET /api/crawler/state — read the crawler state.
   */
  app.get('/state', async () => {
    const rows = await db
      .select()
      .from(crawlerState)
      .where(eq(crawlerState.id, 'main'))
      .limit(1);

    if (rows.length === 0) {
      return {
        scanFloor: 0,
        scanCeiling: 0,
        scanPosition: 0,
        initialCollectionDone: false,
        updatedAt: null,
      };
    }
    return rows[0];
  });

  /**
   * PUT /api/crawler/state — upsert crawler state. Always overwrites provided fields.
   */
  app.put<{ Body: CrawlerStateUpdate }>('/state', async (req) => {
    const { scanFloor, scanCeiling, scanPosition, initialCollectionDone } = req.body;

    const current = await db
      .select()
      .from(crawlerState)
      .where(eq(crawlerState.id, 'main'))
      .limit(1);

    if (current.length === 0) {
      const [row] = await db.insert(crawlerState).values({
        id: 'main',
        scanFloor: scanFloor ?? 0,
        scanCeiling: scanCeiling ?? 0,
        scanPosition: scanPosition ?? 0,
        initialCollectionDone: initialCollectionDone ?? false,
        updatedAt: new Date(),
      }).returning();
      return row;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (scanFloor !== undefined) updates.scanFloor = scanFloor;
    if (scanCeiling !== undefined) updates.scanCeiling = scanCeiling;
    if (scanPosition !== undefined) updates.scanPosition = scanPosition;
    if (initialCollectionDone !== undefined) updates.initialCollectionDone = initialCollectionDone;

    const [row] = await db
      .update(crawlerState)
      .set(updates)
      .where(eq(crawlerState.id, 'main'))
      .returning();

    return row;
  });

  /**
   * POST /api/crawler/matches — bulk insert processed matches with child data.
   * Uses ON CONFLICT DO NOTHING on fightId for idempotency.
   */
  app.post<{ Body: MatchInsert[] }>('/matches', async (req, reply) => {
    const matches = req.body;
    if (!Array.isArray(matches) || matches.length === 0) {
      return reply.status(400).send({ error: 'Expected non-empty array of matches' });
    }

    let inserted = 0;
    let skipped = 0;

    for (const match of matches) {
      // Try to insert the parent match row
      const result = await db
        .insert(processedMatches)
        .values({
          fightId: match.fightId,
          mapId: match.mapId,
          mapName: match.mapName,
          isRanked: match.isRanked,
          winnerTeam: match.winnerTeam,
          playerCount: match.playerCount,
          totalPlayTimeSec: match.totalPlayTimeSec,
          endTime: match.endTime,
        })
        .onConflictDoNothing({ target: processedMatches.fightId })
        .returning({ fightId: processedMatches.fightId });

      if (result.length === 0) {
        skipped++;
        continue;
      }

      inserted++;
      const childInserts: Promise<unknown>[] = [];

      // Insert team results
      if (match.teams && match.teams.length > 0) {
        childInserts.push(
          db.insert(matchTeamResults).values(
            match.teams.map((t) => ({
              fightId: match.fightId,
              teamId: t.teamId,
              factionName: t.factionName,
              isWinner: t.isWinner,
              avgRating: t.avgRating,
            })),
          ),
        );
      }

      // Insert player picks
      if (match.playerPicks && match.playerPicks.length > 0) {
        childInserts.push(
          db.insert(matchPlayerPicks).values(
            match.playerPicks.map((p) => ({
              fightId: match.fightId,
              steamId: p.steamId,
              odId: p.odId,
              teamId: p.teamId,
              spec1Id: p.spec1Id,
              spec1Name: p.spec1Name,
              spec2Id: p.spec2Id,
              spec2Name: p.spec2Name,
              factionName: p.factionName,
              oldRating: p.oldRating,
              newRating: p.newRating,
              destruction: p.destruction,
              playerLosses: p.losses,
              damageDealt: p.damageDealt,
              damageReceived: p.damageReceived,
              objectivesCaptured: p.objectivesCaptured,
            })),
          ),
        );
      }

      // Insert unit deployments (per-player-per-unit with full metrics)
      if (match.unitDeployments && match.unitDeployments.length > 0) {
        childInserts.push(
          db.insert(matchUnitDeployments).values(
            match.unitDeployments.map((u) => ({
              fightId: match.fightId,
              steamId: u.steamId,
              odId: u.odId,
              unitId: u.unitId,
              unitName: u.unitName,
              factionName: u.factionName,
              optionIds: u.optionIds,
              configKey: u.configKey,
              playerRating: u.playerRating,
              eloBracket: u.eloBracket,
              killedCount: u.killedCount,
              totalDamageDealt: u.totalDamageDealt,
              totalDamageReceived: u.totalDamageReceived,
              supplyPointsConsumed: u.supplyPointsConsumed,
              wasRefunded: u.wasRefunded,
            })),
          ),
        );
      }

      await Promise.all(childInserts);
    }

    return reply.status(201).send({ inserted, skipped });
  });

  /**
   * GET /api/crawler/matches/by-player?steamId=X&odId=Y&limit=100
   * Returns a player's recent ranked matches with full detail for profile pages.
   * Looks up by steamId OR odId — at least one must be provided.
   */
  app.get<{
    Querystring: { steamId?: string; odId?: string; limit?: string };
  }>('/matches/by-player', async (req, reply) => {
    const { steamId, odId: odIdStr, limit: limitStr } = req.query;
    const odId = odIdStr ? Number(odIdStr) : undefined;

    if (!steamId && !odId) {
      return reply.status(400).send({ error: 'steamId or odId is required' });
    }

    const limit = Math.min(Math.max(Number(limitStr) || 100, 1), 200);

    // Step 1: Find the player's recent ranked matches
    const playerCondition = steamId && odId
      ? sql`(${matchPlayerPicks.steamId} = ${steamId} OR ${matchPlayerPicks.odId} = ${odId})`
      : steamId
        ? eq(matchPlayerPicks.steamId, steamId)
        : eq(matchPlayerPicks.odId, odId!);

    const playerMatches = await db
      .select({
        fightId: processedMatches.fightId,
        mapId: processedMatches.mapId,
        mapName: processedMatches.mapName,
        isRanked: processedMatches.isRanked,
        winnerTeam: processedMatches.winnerTeam,
        playerCount: processedMatches.playerCount,
        totalPlayTimeSec: processedMatches.totalPlayTimeSec,
        endTime: processedMatches.endTime,
        // Player's own data
        playerTeamId: matchPlayerPicks.teamId,
        playerFaction: matchPlayerPicks.factionName,
        spec1Name: matchPlayerPicks.spec1Name,
        spec1Id: matchPlayerPicks.spec1Id,
        spec2Name: matchPlayerPicks.spec2Name,
        spec2Id: matchPlayerPicks.spec2Id,
        oldRating: matchPlayerPicks.oldRating,
        newRating: matchPlayerPicks.newRating,
        destruction: matchPlayerPicks.destruction,
        playerLosses: matchPlayerPicks.playerLosses,
        damageDealt: matchPlayerPicks.damageDealt,
        damageReceived: matchPlayerPicks.damageReceived,
        objectivesCaptured: matchPlayerPicks.objectivesCaptured,
      })
      .from(matchPlayerPicks)
      .innerJoin(processedMatches, eq(matchPlayerPicks.fightId, processedMatches.fightId))
      .where(and(playerCondition, eq(processedMatches.isRanked, true)))
      .orderBy(sql`${processedMatches.endTime} DESC NULLS LAST`)
      .limit(limit);

    if (playerMatches.length === 0) {
      return { matches: [], teams: [], units: [], otherPlayers: [] };
    }

    const fightIds = playerMatches.map((m) => m.fightId);

    // Steps 2-4 in parallel: teams, player's units, other players in same matches
    const [teams, units, otherPlayers] = await Promise.all([
      // Team results for all matched fights
      db
        .select({
          fightId: matchTeamResults.fightId,
          teamId: matchTeamResults.teamId,
          factionName: matchTeamResults.factionName,
          isWinner: matchTeamResults.isWinner,
          avgRating: matchTeamResults.avgRating,
        })
        .from(matchTeamResults)
        .where(inArray(matchTeamResults.fightId, fightIds)),

      // Player's unit deployments in those matches
      db
        .select({
          fightId: matchUnitDeployments.fightId,
          unitId: matchUnitDeployments.unitId,
          unitName: matchUnitDeployments.unitName,
          factionName: matchUnitDeployments.factionName,
          optionIds: matchUnitDeployments.optionIds,
          configKey: matchUnitDeployments.configKey,
          killedCount: matchUnitDeployments.killedCount,
          totalDamageDealt: matchUnitDeployments.totalDamageDealt,
          totalDamageReceived: matchUnitDeployments.totalDamageReceived,
          supplyPointsConsumed: matchUnitDeployments.supplyPointsConsumed,
          wasRefunded: matchUnitDeployments.wasRefunded,
        })
        .from(matchUnitDeployments)
        .where(
          and(
            inArray(matchUnitDeployments.fightId, fightIds),
            steamId && odId
              ? sql`(${matchUnitDeployments.steamId} = ${steamId} OR ${matchUnitDeployments.odId} = ${odId})`
              : steamId
                ? eq(matchUnitDeployments.steamId, steamId)
                : eq(matchUnitDeployments.odId, odId!),
          ),
        ),

      // Other players in same matches (for teammate/opponent detection)
      db
        .select({
          fightId: matchPlayerPicks.fightId,
          odId: matchPlayerPicks.odId,
          steamId: matchPlayerPicks.steamId,
          teamId: matchPlayerPicks.teamId,
          factionName: matchPlayerPicks.factionName,
          spec1Name: matchPlayerPicks.spec1Name,
          spec2Name: matchPlayerPicks.spec2Name,
        })
        .from(matchPlayerPicks)
        .where(
          and(
            inArray(matchPlayerPicks.fightId, fightIds),
            // Exclude the target player
            steamId && odId
              ? sql`NOT (${matchPlayerPicks.steamId} = ${steamId} OR ${matchPlayerPicks.odId} = ${odId})`
              : steamId
                ? sql`${matchPlayerPicks.steamId} IS DISTINCT FROM ${steamId}`
                : sql`${matchPlayerPicks.odId} IS DISTINCT FROM ${odId}`,
          ),
        ),
    ]);

    return { matches: playerMatches, teams, units, otherPlayers };
  });

  /**
   * GET /api/crawler/matches/exists?ids=1,2,3
   * Returns which of the provided fight IDs already exist.
   */
  app.get<{
    Querystring: { ids: string };
  }>('/matches/exists', async (req, reply) => {
    const idsStr = req.query.ids;
    if (!idsStr) {
      return reply.status(400).send({ error: 'ids query parameter is required' });
    }

    const ids = idsStr.split(',').map(Number).filter(Number.isFinite);
    if (ids.length === 0) {
      return { existing: [] };
    }

    // Query in chunks of 500 to avoid oversized IN clauses
    const existing: number[] = [];
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const rows = await db
        .select({ fightId: processedMatches.fightId })
        .from(processedMatches)
        .where(inArray(processedMatches.fightId, chunk));
      existing.push(...rows.map((r) => r.fightId));
    }

    return { existing };
  });

  /**
   * GET /api/crawler/matches/aggregates?since=ISO&until=ISO
   * Computes faction/spec/map/unit aggregates from ranked matches in the time window.
   */
  app.get<{
    Querystring: { since: string; until?: string };
  }>('/matches/aggregates', async (req, reply) => {
    const since = req.query.since;
    if (!since) {
      return reply.status(400).send({ error: 'since query parameter is required' });
    }

    // endTime is stored in epoch SECONDS (from S3), convert to match
    const sinceSec = Math.floor(new Date(since).getTime() / 1000);
    const untilSec = req.query.until
      ? Math.floor(new Date(req.query.until).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    // Only aggregate ranked matches within the time window
    const rankedFilter = and(
      eq(processedMatches.isRanked, true),
      gte(processedMatches.endTime, sinceSec),
      lte(processedMatches.endTime, untilSec),
    );

    // Faction win rates — exclude mirror matches (both teams same faction)
    const factionWinRates = await db.execute(sql`
      SELECT
        t.faction_name AS "factionName",
        count(*)::int AS "matchCount",
        sum(case when t.is_winner then 1 else 0 end)::int AS "winCount"
      FROM match_team_results t
      JOIN processed_matches m ON t.fight_id = m.fight_id
      WHERE m.is_ranked = true
        AND m.end_time >= ${sinceSec}
        AND m.end_time <= ${untilSec}
        AND t.fight_id NOT IN (
          SELECT a.fight_id
          FROM match_team_results a
          JOIN match_team_results b ON a.fight_id = b.fight_id AND a.team_id < b.team_id
          WHERE a.faction_name = b.faction_name
        )
      GROUP BY t.faction_name
    `);

    // Spec popularity (count spec1 and spec2 separately)
    const specPopularity = await db
      .select({
        specName: sql<string>`spec_name`,
        specId: sql<number>`spec_id`,
        pickCount: sql<number>`count(*)::int`,
      })
      .from(
        sql`(
          SELECT ${matchPlayerPicks.spec1Name} as spec_name, ${matchPlayerPicks.spec1Id} as spec_id, ${matchPlayerPicks.fightId} as fight_id
          FROM ${matchPlayerPicks}
          WHERE ${matchPlayerPicks.spec1Name} IS NOT NULL
          UNION ALL
          SELECT ${matchPlayerPicks.spec2Name} as spec_name, ${matchPlayerPicks.spec2Id} as spec_id, ${matchPlayerPicks.fightId} as fight_id
          FROM ${matchPlayerPicks}
          WHERE ${matchPlayerPicks.spec2Name} IS NOT NULL
        ) as specs`,
      )
      .innerJoin(processedMatches, sql`specs.fight_id = ${processedMatches.fightId}`)
      .where(rankedFilter)
      .groupBy(sql`spec_name, spec_id`);

    // Map popularity
    const mapPopularity = await db
      .select({
        mapName: processedMatches.mapName,
        playCount: sql<number>`count(*)::int`,
      })
      .from(processedMatches)
      .where(and(rankedFilter, sql`${processedMatches.mapName} IS NOT NULL`))
      .groupBy(processedMatches.mapName);

    // Unit performance per config + ELO bracket
    const unitPerformance = await db
      .select({
        configKey: matchUnitDeployments.configKey,
        unitId: matchUnitDeployments.unitId,
        unitName: matchUnitDeployments.unitName,
        factionName: matchUnitDeployments.factionName,
        optionIds: matchUnitDeployments.optionIds,
        eloBracket: matchUnitDeployments.eloBracket,
        deployCount: sql<number>`count(*)::int`,
        totalKills: sql<number>`sum(${matchUnitDeployments.killedCount})::int`,
        totalDamageDealt: sql<number>`sum(${matchUnitDeployments.totalDamageDealt})::float`,
        totalDamageReceived: sql<number>`sum(${matchUnitDeployments.totalDamageReceived})::float`,
        totalSupplyConsumed: sql<number>`sum(${matchUnitDeployments.supplyPointsConsumed})::float`,
        refundCount: sql<number>`sum(case when ${matchUnitDeployments.wasRefunded} then 1 else 0 end)::int`,
      })
      .from(matchUnitDeployments)
      .innerJoin(processedMatches, eq(matchUnitDeployments.fightId, processedMatches.fightId))
      .where(rankedFilter)
      .groupBy(
        matchUnitDeployments.configKey,
        matchUnitDeployments.unitId,
        matchUnitDeployments.unitName,
        matchUnitDeployments.factionName,
        matchUnitDeployments.optionIds,
        matchUnitDeployments.eloBracket,
      );

    return { factionWinRates, specPopularity, mapPopularity, unitPerformance };
  });

  /**
   * GET /api/crawler/matches/unit-performance?since=30d&eloBracket=...&faction=...&limit=100
   * Rolling query against raw match data — no snapshots involved.
   */
  app.get<{
    Querystring: { since?: string; eloBracket?: string; faction?: string; limit?: string };
  }>('/matches/unit-performance', async (req) => {
    const sinceParam = req.query.since ?? '30d';
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const elo = req.query.eloBracket ?? '';
    const faction = req.query.faction ?? '';
    const cacheKey = `unit-perf:${sinceParam}:${elo}:${faction}:${limit}`;

    return cached(cacheKey, CACHE_5MIN, async () => {
    const sinceSec = parseSinceToEpochSec(sinceParam);

    const conditions = [
      eq(processedMatches.isRanked, true),
      gte(processedMatches.endTime, sinceSec),
    ];

    if (elo) {
      conditions.push(eq(matchUnitDeployments.eloBracket, elo));
    }
    if (faction) {
      conditions.push(eq(matchUnitDeployments.factionName, faction));
    }

    const rows = await db
      .select({
        configKey: matchUnitDeployments.configKey,
        unitId: matchUnitDeployments.unitId,
        unitName: matchUnitDeployments.unitName,
        factionName: matchUnitDeployments.factionName,
        optionIds: matchUnitDeployments.optionIds,
        eloBracket: matchUnitDeployments.eloBracket,
        deployCount: sql<number>`count(*)::int`,
        totalKills: sql<number>`sum(${matchUnitDeployments.killedCount})::int`,
        avgKills: sql<number>`round(avg(${matchUnitDeployments.killedCount})::numeric, 2)::float`,
        totalDamageDealt: sql<number>`sum(${matchUnitDeployments.totalDamageDealt})::float`,
        avgDamage: sql<number>`round(avg(${matchUnitDeployments.totalDamageDealt})::numeric, 0)::float`,
        totalDamageReceived: sql<number>`sum(${matchUnitDeployments.totalDamageReceived})::float`,
        totalSupplyConsumed: sql<number>`sum(${matchUnitDeployments.supplyPointsConsumed})::float`,
        refundCount: sql<number>`sum(case when ${matchUnitDeployments.wasRefunded} then 1 else 0 end)::int`,
      })
      .from(matchUnitDeployments)
      .innerJoin(processedMatches, eq(matchUnitDeployments.fightId, processedMatches.fightId))
      .where(and(...conditions))
      .groupBy(
        matchUnitDeployments.configKey,
        matchUnitDeployments.unitId,
        matchUnitDeployments.unitName,
        matchUnitDeployments.factionName,
        matchUnitDeployments.optionIds,
        matchUnitDeployments.eloBracket,
      )
      .orderBy(sql`count(*) DESC`)
      .limit(limit);

    return { rows, since: new Date(sinceSec * 1000).toISOString() };
    }); // end cached
  });

  /**
   * GET /api/crawler/matches/spec-combos?since=30d&limit=20
   * Returns the most popular spec1+spec2 combinations from ranked matches.
   */
  app.get<{
    Querystring: { since?: string; limit?: string };
  }>('/matches/spec-combos', async (req) => {
    const sinceParam = req.query.since ?? '30d';
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    const sinceSec = parseSinceToEpochSec(sinceParam);

    const cacheKey = `spec-combos:${sinceSec}:${limit}`;

    return cached(cacheKey, CACHE_15MIN, async () => {
      // Normalize combos so (A,B) and (B,A) are the same
      const rows = await db.execute(sql`
        SELECT
          CASE WHEN p.spec1_name <= p.spec2_name THEN p.spec1_name ELSE p.spec2_name END AS "spec1",
          CASE WHEN p.spec1_name <= p.spec2_name THEN p.spec2_name ELSE p.spec1_name END AS "spec2",
          p.faction_name AS "faction",
          count(*)::int AS "pickCount"
        FROM match_player_picks p
        JOIN processed_matches m ON p.fight_id = m.fight_id
        WHERE m.is_ranked = true
          AND m.end_time >= ${sinceSec}
          AND p.spec1_name IS NOT NULL
          AND p.spec2_name IS NOT NULL
        GROUP BY 1, 2, p.faction_name
        ORDER BY "pickCount" DESC
        LIMIT ${limit}
      `);

      return { rows, since: new Date(sinceSec * 1000).toISOString() };
    });
  });

  /**
   * DELETE /api/crawler/matches/unranked
   * Removes all unranked matches (and cascades to child tables).
   */
  app.delete('/matches/unranked', async () => {
    const result = await db
      .delete(processedMatches)
      .where(eq(processedMatches.isRanked, false))
      .returning({ fightId: processedMatches.fightId });

    return { deleted: result.length };
  });

  /**
   * DELETE /api/crawler/matches/prune?olderThanDays=30
   * Removes processed matches (and cascades to all child tables) older than N days.
   */
  app.delete<{
    Querystring: { olderThanDays?: string };
  }>('/matches/prune', async (req) => {
    const days = Math.max(Number(req.query.olderThanDays) ?? 30, 0); // 0 = delete all
    const cutoffSec = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);

    const result = await db
      .delete(processedMatches)
      .where(
        and(
          sql`${processedMatches.endTime} IS NOT NULL`,
          sql`${processedMatches.endTime} < ${cutoffSec}`,
        ),
      )
      .returning({ fightId: processedMatches.fightId });

    return { pruned: result.length, cutoffDays: days };
  });
}
