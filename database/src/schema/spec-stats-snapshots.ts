import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { statSnapshots } from './stat-snapshots.js';

/**
 * Specialization pick counts captured at a point in time.
 * Each row = one spec's pick count within one snapshot period.
 */
export const specStatsSnapshots = pgTable('spec_stats_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  snapshotId: uuid('snapshot_id').notNull().references(() => statSnapshots.id, { onDelete: 'cascade' }),
  specName: text('spec_name').notNull(),
  specId: integer('spec_id'),
  pickCount: integer('pick_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_spec_stats_snapshots_snapshot').on(table.snapshotId),
  index('idx_spec_stats_snapshots_spec').on(table.specName),
]);
