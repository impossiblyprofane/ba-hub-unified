import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * Meta table for periodic data collection snapshots.
 * Each row represents one collection run with a granularity type.
 */
export const statSnapshots = pgTable('stat_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Granularity: 'hourly' | 'daily' | 'weekly' | 'monthly' */
  snapshotType: text('snapshot_type').notNull(),
  /** When this snapshot was collected. */
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_stat_snapshots_type').on(table.snapshotType),
  index('idx_stat_snapshots_created_at').on(table.createdAt),
]);
