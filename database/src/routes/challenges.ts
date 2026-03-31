import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { challenges } from '../schema/index.js';
import { eq, lt } from 'drizzle-orm';
import type { TrivialChallenge } from '@ba-hub/shared';

/**
 * Trivial math challenge routes.
 *
 * GET  /           → generate a new challenge
 * POST /verify     → verify a challenge answer (internal, called by deck routes)
 */
export async function registerChallengeRoutes(app: FastifyInstance) {
  // ── Generate a new challenge ───────────────────────────────
  app.get<{ Reply: TrivialChallenge }>('/', async (_req, reply) => {
    // Clean up expired challenges (older than 5 minutes)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    await db.delete(challenges).where(lt(challenges.createdAt, fiveMinAgo));

    // Generate simple math problem
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    const ops = ['+', '-', '×'] as const;
    const op = ops[Math.floor(Math.random() * ops.length)];

    let answer: number;
    switch (op) {
      case '+': answer = a + b; break;
      case '-': answer = a - b; break;
      case '×': answer = a * b; break;
    }

    const question = `What is ${a} ${op} ${b}?`;

    const [row] = await db.insert(challenges).values({
      answer,
      question,
    }).returning({ id: challenges.id, question: challenges.question });

    return reply.send({
      challengeId: row.id,
      question: row.question,
    });
  });
}

/**
 * Verify a challenge answer. Returns true if correct, false otherwise.
 * Deletes the challenge row regardless (one-time use).
 */
export async function verifyChallenge(challengeId: string, answer: number): Promise<boolean> {
  const [row] = await db
    .delete(challenges)
    .where(eq(challenges.id, challengeId))
    .returning({ answer: challenges.answer, createdAt: challenges.createdAt });

  if (!row) return false;

  // Expired check (5 minute TTL)
  const age = Date.now() - new Date(row.createdAt).getTime();
  if (age > 5 * 60 * 1000) return false;

  return row.answer === answer;
}
