import { pgTable, integer, text, boolean, bigint, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * Permanent record of each processed fight from S3.
 * Uses the S3 fight ID as a natural primary key.
 */
export const processedMatches = pgTable('processed_matches', {
  /** S3 fight ID (incremental integer). */
  fightId: integer('fight_id').primaryKey(),
  mapId: integer('map_id'),
  mapName: text('map_name'),
  /** True if any player had rating changes (ranked game). */
  isRanked: boolean('is_ranked').notNull().default(false),
  /** Team ID of the winning side (null for draws / unknown). */
  winnerTeam: integer('winner_team'),
  playerCount: integer('player_count').notNull().default(0),
  totalPlayTimeSec: integer('total_play_time_sec'),
  /** Epoch milliseconds from the S3 fight data. */
  endTime: bigint('end_time', { mode: 'number' }),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_processed_matches_end_time').on(table.endTime),
  index('idx_processed_matches_ranked').on(table.isRanked),
]);
