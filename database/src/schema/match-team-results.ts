import { pgTable, uuid, integer, text, boolean, real, index } from 'drizzle-orm/pg-core';
import { processedMatches } from './processed-matches.js';

/**
 * Per-team outcome for each processed match (2 rows per match).
 * Faction is determined by the majority CountryId of deployed units.
 */
export const matchTeamResults = pgTable('match_team_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  fightId: integer('fight_id').notNull().references(() => processedMatches.fightId, { onDelete: 'cascade' }),
  teamId: integer('team_id').notNull(),
  /** Majority faction name derived from deployed units' CountryId. */
  factionName: text('faction_name').notNull(),
  isWinner: boolean('is_winner').notNull(),
  /** Average player rating on this team at match start. */
  avgRating: real('avg_rating'),
}, (table) => [
  index('idx_match_team_results_fight').on(table.fightId),
  index('idx_match_team_results_faction').on(table.factionName),
]);
