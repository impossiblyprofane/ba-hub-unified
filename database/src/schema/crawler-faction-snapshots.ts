import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { statSnapshots } from './stat-snapshots.js';

/**
 * Crawler-derived faction win rates per snapshot period.
 * Separate from faction_stats_snapshots (which uses external API lifetime data).
 * This table stores win rates computed from actual crawled ranked matches.
 */
export const crawlerFactionSnapshots = pgTable('crawler_faction_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  snapshotId: uuid('snapshot_id').notNull().references(() => statSnapshots.id, { onDelete: 'cascade' }),
  factionName: text('faction_name').notNull(),
  matchCount: integer('match_count').notNull().default(0),
  winCount: integer('win_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_crawler_faction_snapshots_snapshot').on(table.snapshotId),
  index('idx_crawler_faction_snapshots_faction').on(table.factionName),
]);
