import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import {
  statSnapshots,
  leaderboardSnapshots,
} from '../schema/index.js';
import { eq, gte, and, sql } from 'drizzle-orm';

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
}

// ── Routes ───────────────────────────────────────────────────────

export async function registerSnapshotRoutes(app: FastifyInstance) {
  /**
   * POST /api/snapshots — create a new snapshot with leaderboard data.
   * Called by the collection scheduler on the backend.
   */
  app.post<{ Body: CreateSnapshotBody }>('/', async (req, reply) => {
    const { snapshotType, leaderboard } = req.body;

    if (!['hourly', 'daily', 'weekly', 'monthly'].includes(snapshotType)) {
      return reply.status(400).send({ error: 'Invalid snapshotType' });
    }

    // Create the parent snapshot row
    const [snapshot] = await db.insert(statSnapshots).values({
      snapshotType,
    }).returning();

    const snapshotId = snapshot.id;

    if (leaderboard && leaderboard.length > 0) {
      await db.insert(leaderboardSnapshots).values(
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
      );
    }

    return reply.status(201).send({
      id: snapshotId,
      snapshotType,
      leaderboardCount: leaderboard?.length ?? 0,
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
   * DELETE /api/snapshots/prune — remove old snapshots based on retention policy.
   * Retention: hourly > 48h deleted, daily > 14d deleted, weekly > 60d deleted.
   * Monthly is kept indefinitely.
   */
  app.delete('/prune', async () => {
    const now = Date.now();

    const cutoffs: { type: SnapshotType; maxAge: number }[] = [
      { type: 'hourly', maxAge: 48 * 60 * 60 * 1000 },      // 48 hours
      { type: 'daily', maxAge: 14 * 24 * 60 * 60 * 1000 },   // 14 days
      { type: 'weekly', maxAge: 60 * 24 * 60 * 60 * 1000 },  // 60 days
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
      totalDeleted++;
    }

    return { pruned: true, typesProcessed: totalDeleted };
  });
}
