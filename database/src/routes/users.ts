import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { users } from '../schema/index.js';
import { eq, sql } from 'drizzle-orm';
import type { RegisterUserInput, RegisterUserResult, UserProfile } from '@ba-hub/shared';

/**
 * User routes — anonymous GUID-based identity.
 *
 * POST /register   → register or confirm a user GUID
 * GET  /:id        → get user profile summary
 */
export async function registerUserRoutes(app: FastifyInstance) {
  // ── Register / confirm ─────────────────────────────────────
  app.post<{ Body: RegisterUserInput; Reply: RegisterUserResult }>('/register', async (req, reply) => {
    const { tentativeId } = req.body;

    if (!tentativeId || typeof tentativeId !== 'string') {
      return reply.status(400).send({ error: 'tentativeId is required' } as any);
    }

    // Try to find existing user
    const existing = await db.select().from(users).where(eq(users.id, tentativeId)).limit(1);

    if (existing.length > 0) {
      // Update lastSeenAt
      await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, tentativeId));
      return reply.send({ userId: tentativeId, isNew: false });
    }

    // Create new user with the frontend-generated ID
    try {
      await db.insert(users).values({ id: tentativeId });
      return reply.send({ userId: tentativeId, isNew: true });
    } catch {
      // Race condition — another request created the user between our SELECT and INSERT
      return reply.send({ userId: tentativeId, isNew: false });
    }
  });

  // ── Profile summary ────────────────────────────────────────
  app.get<{ Params: { id: string }; Reply: UserProfile }>('/:id', async (req, reply) => {
    const { id } = req.params;

    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' } as any);
    }

    // Get publish count + total likes in one query
    const [stats] = await db.execute<{
      published_count: string;
      total_likes: string;
    }>(sql`
      SELECT
        COUNT(*)::text AS published_count,
        COALESCE(SUM(like_count), 0)::text AS total_likes
      FROM published_decks
      WHERE author_id = ${id} AND is_deleted = false
    `);

    return reply.send({
      id: user.id,
      publishedCount: Number(stats?.published_count ?? 0),
      totalLikesReceived: Number(stats?.total_likes ?? 0),
      createdAt: user.createdAt.toISOString(),
    });
  });
}
