import { pgTable, uuid, text, integer, real, timestamp, index } from 'drizzle-orm/pg-core';
import { statSnapshots } from './stat-snapshots.js';

/**
 * Unit performance aggregates captured at a point in time.
 * Each row = one unit config + ELO bracket within one snapshot period.
 * Includes deploy count, kills, damage, supply, and refund metrics.
 */
export const unitPerformanceSnapshots = pgTable('unit_performance_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  snapshotId: uuid('snapshot_id').notNull().references(() => statSnapshots.id, { onDelete: 'cascade' }),
  /** Unique config fingerprint: "unitId:opt1,opt2". */
  configKey: text('config_key').notNull(),
  unitId: integer('unit_id'),
  unitName: text('unit_name').notNull(),
  factionName: text('faction_name').notNull(),
  /** Sorted comma-separated option IDs. */
  optionIds: text('option_ids').notNull().default(''),
  /** ELO bracket bucket. */
  eloBracket: text('elo_bracket').notNull().default('unranked'),
  // ── Aggregated metrics ──
  deployCount: integer('deploy_count').notNull().default(0),
  totalKills: integer('total_kills').notNull().default(0),
  totalDamageDealt: real('total_damage_dealt').notNull().default(0),
  totalDamageReceived: real('total_damage_received').notNull().default(0),
  totalSupplyConsumed: real('total_supply_consumed').notNull().default(0),
  refundCount: integer('refund_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_unit_perf_snapshots_snapshot').on(table.snapshotId),
  index('idx_unit_perf_snapshots_config').on(table.configKey),
  index('idx_unit_perf_snapshots_faction').on(table.factionName),
  index('idx_unit_perf_snapshots_elo').on(table.eloBracket),
]);
