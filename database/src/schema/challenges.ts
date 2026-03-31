import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';

/**
 * Trivial math challenges — in-memory would be simpler, but storing in DB
 * allows the database service to be stateless / horizontally scalable.
 * Rows are cleaned up periodically (TTL ~5 minutes).
 */
export const challenges = pgTable('challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** The correct numeric answer. */
  answer: integer('answer').notNull(),
  /** Human-readable question text, e.g. "What is 7 + 3?" */
  question: text('question').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
