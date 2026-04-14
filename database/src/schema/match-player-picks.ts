import { pgTable, uuid, integer, text, real, index } from 'drizzle-orm/pg-core';
import { processedMatches } from './processed-matches.js';

/**
 * Per-player participation record for each processed match.
 * Includes specialization picks (inferred from deployed units),
 * per-match performance stats, and player identity for lookups.
 */
export const matchPlayerPicks = pgTable('match_player_picks', {
  id: uuid('id').primaryKey().defaultRandom(),
  fightId: integer('fight_id').notNull().references(() => processedMatches.fightId, { onDelete: 'cascade' }),
  /** Steam ID (when available from S3 data — not always present). */
  steamId: text('steam_id'),
  /** Internal player ID from the external API / S3 fight data (reliable identifier). */
  odId: integer('od_id'),
  /** Which team the player was on. */
  teamId: integer('team_id'),
  spec1Id: integer('spec1_id'),
  spec1Name: text('spec1_name'),
  spec2Id: integer('spec2_id'),
  spec2Name: text('spec2_name'),
  /** Faction the player was playing (majority from their units). */
  factionName: text('faction_name').notNull(),
  // ── Per-match performance stats from S3 fight data ──
  /** Player's ELO rating before this match. */
  oldRating: real('old_rating'),
  /** Player's ELO rating after this match. */
  newRating: real('new_rating'),
  /** Player's destruction score. */
  destruction: integer('destruction'),
  /** Player's losses score. */
  playerLosses: integer('player_losses'),
  /** Player's total damage dealt. */
  damageDealt: real('damage_dealt'),
  /** Player's total damage received. */
  damageReceived: real('damage_received'),
  /** Objectives captured by this player. */
  objectivesCaptured: integer('objectives_captured'),
}, (table) => [
  index('idx_match_player_picks_fight').on(table.fightId),
  index('idx_match_player_picks_spec1').on(table.spec1Name),
  index('idx_match_player_picks_steam').on(table.steamId),
  index('idx_match_player_picks_od').on(table.odId),
]);
