import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { statSnapshots } from './stat-snapshots.js';

/**
 * Faction/country match and win counts captured at a point in time.
 * Each row = one faction's match-count and win-count within one snapshot.
 */
export const factionStatsSnapshots = pgTable('faction_stats_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  snapshotId: uuid('snapshot_id').notNull().references(() => statSnapshots.id, { onDelete: 'cascade' }),
  factionName: text('faction_name').notNull(),
  matchCount: integer('match_count').notNull().default(0),
  winCount: integer('win_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_faction_stats_snapshots_snapshot').on(table.snapshotId),
  index('idx_faction_stats_snapshots_faction').on(table.factionName),
]);
