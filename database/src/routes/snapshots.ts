import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import {
  statSnapshots,
  leaderboardSnapshots,
  mapStatsSnapshots,
  factionStatsSnapshots,
  unitStatsSnapshots,
} from '../schema/index.js';
import { eq, desc, gte, and, sql } from 'drizzle-orm';

// ── Types ────────────────────────────────────────────────────────

type SnapshotType = 'hourly' | 'daily' | 'weekly' | 'monthly';

interface CreateSnapshotBody {
  snapshotType: SnapshotType;
  leaderboard?: Array<{
    rank: number;
    userId?: number;
    steamId?: string;
    name?: string;
    rating?: number;
    elo?: number;
    level?: number;
    winRate?: number;
    kdRatio?: number;
  }>;
  mapStats?: Array<{
    mapName: string;
    playCount: number;
  }>;
  factionStats?: Array<{
    factionName: string;
    matchCount: number;
    winCount: number;
  }>;
  unitStats?: Array<{
    unitName: string;
    timesDeployed: number;
    totalKills: number;
    totalDamageDealt: number;
    totalDamageReceived: number;
    totalSupplyConsumed: number;
    timesRefunded: number;
  }>;
}

// ── Routes ───────────────────────────────────────────────────────

export async function registerSnapshotRoutes(app: FastifyInstance) {
  /**
   * POST /api/snapshots — create a new snapshot with all associated data
   * Called by the collection scheduler on the backend.
   */
  app.post<{ Body: CreateSnapshotBody }>('/', async (req, reply) => {
    const { snapshotType, leaderboard, mapStats, factionStats, unitStats } = req.body;

    if (!['hourly', 'daily', 'weekly', 'monthly'].includes(snapshotType)) {
      return reply.status(400).send({ error: 'Invalid snapshotType' });
    }

    // Create the parent snapshot row
    const [snapshot] = await db.insert(statSnapshots).values({
      snapshotType,
    }).returning();

    const snapshotId = snapshot.id;

    // Insert child data in parallel
    const inserts: Promise<unknown>[] = [];

    if (leaderboard && leaderboard.length > 0) {
      inserts.push(
        db.insert(leaderboardSnapshots).values(
          leaderboard.map((entry) => ({
            snapshotId,
            rank: entry.rank,
            userId: entry.userId,
            steamId: entry.steamId,
            name: entry.name,
            rating: entry.rating,
            elo: entry.elo,
            level: entry.level,
            winRate: entry.winRate,
            kdRatio: entry.kdRatio,
          })),
        ),
      );
    }

    if (mapStats && mapStats.length > 0) {
      inserts.push(
        db.insert(mapStatsSnapshots).values(
          mapStats.map((entry) => ({
            snapshotId,
            mapName: entry.mapName,
            playCount: entry.playCount,
          })),
        ),
      );
    }

    if (factionStats && factionStats.length > 0) {
      inserts.push(
        db.insert(factionStatsSnapshots).values(
          factionStats.map((entry) => ({
            snapshotId,
            factionName: entry.factionName,
            matchCount: entry.matchCount,
            winCount: entry.winCount,
          })),
        ),
      );
    }

    if (unitStats && unitStats.length > 0) {
      inserts.push(
        db.insert(unitStatsSnapshots).values(
          unitStats.map((entry) => ({
            snapshotId,
            unitName: entry.unitName,
            timesDeployed: entry.timesDeployed,
            totalKills: entry.totalKills,
            totalDamageDealt: entry.totalDamageDealt,
            totalDamageReceived: entry.totalDamageReceived,
            totalSupplyConsumed: entry.totalSupplyConsumed,
            timesRefunded: entry.timesRefunded,
          })),
        ),
      );
    }

    await Promise.all(inserts);

    return reply.status(201).send({
      id: snapshotId,
      snapshotType,
      leaderboardCount: leaderboard?.length ?? 0,
      mapStatsCount: mapStats?.length ?? 0,
      factionStatsCount: factionStats?.length ?? 0,
      unitStatsCount: unitStats?.length ?? 0,
    });
  });

  /**
   * GET /api/snapshots/leaderboard-history?steamId=...&since=ISO
   * Returns leaderboard positions for a player over time.
   */
  app.get<{
    Querystring: { steamId: string; since?: string };
  }>('/leaderboard-history', async (req, reply) => {
    const { steamId, since } = req.query;
    if (!steamId) {
      return reply.status(400).send({ error: 'steamId is required' });
    }

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        rank: leaderboardSnapshots.rank,
        rating: leaderboardSnapshots.rating,
        elo: leaderboardSnapshots.elo,
        winRate: leaderboardSnapshots.winRate,
        kdRatio: leaderboardSnapshots.kdRatio,
        snapshotType: statSnapshots.snapshotType,
        createdAt: statSnapshots.createdAt,
      })
      .from(leaderboardSnapshots)
      .innerJoin(statSnapshots, eq(leaderboardSnapshots.snapshotId, statSnapshots.id))
      .where(
        and(
          eq(leaderboardSnapshots.steamId, steamId),
          gte(statSnapshots.createdAt, sinceDate),
        ),
      )
      .orderBy(statSnapshots.createdAt);

    return rows;
  });

  /**
   * GET /api/snapshots/map-history?since=ISO
   * Returns map play-count trends over time.
   */
  app.get<{
    Querystring: { since?: string };
  }>('/map-history', async (req) => {
    const { since } = req.query;
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        mapName: mapStatsSnapshots.mapName,
        playCount: mapStatsSnapshots.playCount,
        snapshotType: statSnapshots.snapshotType,
        createdAt: statSnapshots.createdAt,
      })
      .from(mapStatsSnapshots)
      .innerJoin(statSnapshots, eq(mapStatsSnapshots.snapshotId, statSnapshots.id))
      .where(gte(statSnapshots.createdAt, sinceDate))
      .orderBy(statSnapshots.createdAt);

    return rows;
  });

  /**
   * GET /api/snapshots/faction-history?since=ISO
   * Returns faction match/win counts over time.
   */
  app.get<{
    Querystring: { since?: string };
  }>('/faction-history', async (req) => {
    const { since } = req.query;
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        factionName: factionStatsSnapshots.factionName,
        matchCount: factionStatsSnapshots.matchCount,
        winCount: factionStatsSnapshots.winCount,
        snapshotType: statSnapshots.snapshotType,
        createdAt: statSnapshots.createdAt,
      })
      .from(factionStatsSnapshots)
      .innerJoin(statSnapshots, eq(factionStatsSnapshots.snapshotId, statSnapshots.id))
      .where(gte(statSnapshots.createdAt, sinceDate))
      .orderBy(statSnapshots.createdAt);

    return rows;
  });

  /**
   * GET /api/snapshots/unit-rankings?limit=50
   * Returns latest unit performance rankings (from the most recent snapshot).
   */
  app.get<{
    Querystring: { limit?: string };
  }>('/unit-rankings', async (req) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    // Find the most recent snapshot that has unit data
    const latestSnapshot = await db
      .select({ id: statSnapshots.id, createdAt: statSnapshots.createdAt })
      .from(statSnapshots)
      .innerJoin(unitStatsSnapshots, eq(unitStatsSnapshots.snapshotId, statSnapshots.id))
      .orderBy(desc(statSnapshots.createdAt))
      .limit(1);

    if (latestSnapshot.length === 0) {
      return { snapshotDate: null, units: [] };
    }

    const snapshotId = latestSnapshot[0].id;

    const units = await db
      .select()
      .from(unitStatsSnapshots)
      .where(eq(unitStatsSnapshots.snapshotId, snapshotId))
      .orderBy(desc(unitStatsSnapshots.totalDamageDealt))
      .limit(limit);

    return {
      snapshotDate: latestSnapshot[0].createdAt,
      units: units.map((u) => ({
        unitName: u.unitName,
        timesDeployed: u.timesDeployed,
        totalKills: u.totalKills,
        totalDamageDealt: u.totalDamageDealt,
        totalDamageReceived: u.totalDamageReceived,
        totalSupplyConsumed: u.totalSupplyConsumed,
        timesRefunded: u.timesRefunded,
        avgKills: u.timesDeployed > 0 ? u.totalKills / u.timesDeployed : 0,
        avgDamage: u.timesDeployed > 0 ? u.totalDamageDealt / u.timesDeployed : 0,
      })),
    };
  });

  /**
   * DELETE /api/snapshots/prune — remove old snapshots based on retention policy.
   * Retention: hourly > 48h deleted, daily > 14d deleted, weekly > 60d deleted.
   * Monthly is kept indefinitely.
   */
  app.delete('/prune', async () => {
    const now = Date.now();

    const cutoffs: { type: SnapshotType; maxAge: number }[] = [
      { type: 'hourly', maxAge: 48 * 60 * 60 * 1000 },  // 48 hours
      { type: 'daily', maxAge: 14 * 24 * 60 * 60 * 1000 },  // 14 days
      { type: 'weekly', maxAge: 60 * 24 * 60 * 60 * 1000 }, // 60 days
    ];

    let totalDeleted = 0;

    for (const { type, maxAge } of cutoffs) {
      const cutoff = new Date(now - maxAge);
      await db
        .delete(statSnapshots)
        .where(
          and(
            eq(statSnapshots.snapshotType, type),
            sql`${statSnapshots.createdAt} < ${cutoff}`,
          ),
        );
      // Cascade delete handles child rows automatically
      totalDeleted++;
    }

    return { pruned: true, typesProcessed: totalDeleted };
  });
}
