import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { statSnapshots } from './stat-snapshots.js';

/**
 * Map play-count data captured at a point in time.
 * Each row = one map's play count within one snapshot.
 */
export const mapStatsSnapshots = pgTable('map_stats_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  snapshotId: uuid('snapshot_id').notNull().references(() => statSnapshots.id, { onDelete: 'cascade' }),
  mapName: text('map_name').notNull(),
  playCount: integer('play_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_map_stats_snapshots_snapshot').on(table.snapshotId),
  index('idx_map_stats_snapshots_map').on(table.mapName),
]);
