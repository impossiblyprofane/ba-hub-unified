import { pgTable, uuid, text, integer, real, timestamp, index } from 'drizzle-orm/pg-core';
import { statSnapshots } from './stat-snapshots.js';

/**
 * Aggregated unit performance data captured at a point in time.
 * Each row = one unit type's cumulative stats within one snapshot.
 * Data is collected by processing fight files from the S3 endpoint.
 */
export const unitStatsSnapshots = pgTable('unit_stats_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  snapshotId: uuid('snapshot_id').notNull().references(() => statSnapshots.id, { onDelete: 'cascade' }),
  unitName: text('unit_name').notNull(),
  /** How many times this unit was deployed across all fights in the period. */
  timesDeployed: integer('times_deployed').notNull().default(0),
  /** Cumulative kills across all deployments. */
  totalKills: integer('total_kills').notNull().default(0),
  /** Cumulative damage dealt across all deployments. */
  totalDamageDealt: real('total_damage_dealt').notNull().default(0),
  /** Cumulative damage received across all deployments. */
  totalDamageReceived: real('total_damage_received').notNull().default(0),
  /** Cumulative supply consumed across all deployments. */
  totalSupplyConsumed: real('total_supply_consumed').notNull().default(0),
  /** Number of times the unit was refunded. */
  timesRefunded: integer('times_refunded').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_unit_stats_snapshots_snapshot').on(table.snapshotId),
  index('idx_unit_stats_snapshots_unit').on(table.unitName),
]);
