import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { statSnapshots } from './stat-snapshots.js';

/**
 * Unit deployment popularity per faction captured at a point in time.
 * Each row = one unit's deploy count within one snapshot period,
 * grouped by the faction (nation) the unit belongs to.
 */
export const unitPopularitySnapshots = pgTable('unit_popularity_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  snapshotId: uuid('snapshot_id').notNull().references(() => statSnapshots.id, { onDelete: 'cascade' }),
  unitName: text('unit_name').notNull(),
  unitId: integer('unit_id'),
  /** Nation/country the unit belongs to. */
  factionName: text('faction_name').notNull(),
  deployCount: integer('deploy_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_unit_popularity_snapshots_snapshot').on(table.snapshotId),
  index('idx_unit_popularity_snapshots_faction').on(table.factionName),
  index('idx_unit_popularity_snapshots_unit').on(table.unitName),
]);
