import { pgTable, uuid, integer, text, index } from 'drizzle-orm/pg-core';
import { processedMatches } from './processed-matches.js';

/**
 * Per-player specialization picks for each processed match.
 * Specs are inferred from deployed units via the specializationAvailabilities reverse index.
 */
export const matchPlayerPicks = pgTable('match_player_picks', {
  id: uuid('id').primaryKey().defaultRandom(),
  fightId: integer('fight_id').notNull().references(() => processedMatches.fightId, { onDelete: 'cascade' }),
  steamId: text('steam_id'),
  spec1Id: integer('spec1_id'),
  spec1Name: text('spec1_name'),
  spec2Id: integer('spec2_id'),
  spec2Name: text('spec2_name'),
  /** Faction the player was playing (majority from their units). */
  factionName: text('faction_name').notNull(),
}, (table) => [
  index('idx_match_player_picks_fight').on(table.fightId),
  index('idx_match_player_picks_spec1').on(table.spec1Name),
]);
