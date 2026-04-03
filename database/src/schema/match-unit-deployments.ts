import { pgTable, uuid, integer, text, real, boolean, index } from 'drizzle-orm/pg-core';
import { processedMatches } from './processed-matches.js';

/**
 * Per-unit-per-player deployment records for each processed match.
 * One row per unit instance deployed by a player (if a player spawns
 * the same unit twice, that's two rows).
 *
 * Includes modification options, performance metrics, and ELO bracket
 * for granular unit performance analysis.
 */
export const matchUnitDeployments = pgTable('match_unit_deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  fightId: integer('fight_id').notNull().references(() => processedMatches.fightId, { onDelete: 'cascade' }),
  unitId: integer('unit_id').notNull(),
  unitName: text('unit_name').notNull(),
  /** Nation/country the unit belongs to (e.g. "Russia", "USA"). */
  factionName: text('faction_name').notNull(),
  /** Sorted comma-separated option IDs (e.g. "12,45,67"). Empty string for stock. */
  optionIds: text('option_ids').notNull().default(''),
  /** Unique config fingerprint: "unitId:opt1,opt2" — for GROUP BY aggregation. */
  configKey: text('config_key').notNull(),
  /** Player's oldRating at match start. Null if unranked/unknown. */
  playerRating: real('player_rating'),
  /** ELO bracket bucket: "0-500", "500-1000", ..., "3000-3500". */
  eloBracket: text('elo_bracket').notNull().default('unranked'),
  // ── Performance metrics from S3 fight data ──
  killedCount: integer('killed_count').notNull().default(0),
  totalDamageDealt: real('total_damage_dealt').notNull().default(0),
  totalDamageReceived: real('total_damage_received').notNull().default(0),
  supplyPointsConsumed: integer('supply_points_consumed').notNull().default(0),
  wasRefunded: boolean('was_refunded').notNull().default(false),
}, (table) => [
  index('idx_match_unit_deployments_fight').on(table.fightId),
  index('idx_match_unit_deployments_unit').on(table.unitId),
  index('idx_match_unit_deployments_config').on(table.configKey),
  index('idx_match_unit_deployments_elo').on(table.eloBracket),
  index('idx_match_unit_deployments_faction').on(table.factionName),
]);
