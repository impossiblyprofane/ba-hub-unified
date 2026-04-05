import { pgTable, integer, jsonb, bigint, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * Raw fight JSON stored as a JSONB blob — one row per match.
 *
 * Standalone table (no FK to processed_matches) so that:
 *   - Write-through inserts (from the /fight/:fightId fallback) can store
 *     a blob even when the match hasn't been crawled yet (no parent row).
 *   - The crawler can independently populate processed_matches + children
 *     alongside this blob without ordering constraints.
 *
 * Pruned by endTime (epoch seconds) — same cutoff logic as processed_matches.
 */
export const fightData = pgTable('fight_data', {
  /** S3 fight ID — natural PK. */
  fightId: integer('fight_id').primaryKey(),
  /** The full normalised FightData JSON blob. */
  data: jsonb('data').notNull(),
  /** Epoch seconds — used for 30-day pruning. */
  endTime: bigint('end_time', { mode: 'number' }),
  storedAt: timestamp('stored_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_fight_data_end_time').on(table.endTime),
]);
