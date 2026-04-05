/**
 * Drizzle schema — all tables for the deck publishing system, leaderboard snapshots, and match crawler.
 */

export { users } from './users.js';
export { publishedDecks } from './published-decks.js';
export { deckLikes } from './deck-likes.js';
export { deckViews } from './deck-views.js';
export { challenges } from './challenges.js';

// ── Leaderboard snapshot tables (kept for rating-over-time tracking) ──
export { statSnapshots } from './stat-snapshots.js';
export { leaderboardSnapshots } from './leaderboard-snapshots.js';

// ── Match crawler tables (raw match data — rolling aggregation queries) ──
export { crawlerState } from './crawler-state.js';
export { processedMatches } from './processed-matches.js';
export { matchTeamResults } from './match-team-results.js';
export { matchPlayerPicks } from './match-player-picks.js';
export { matchUnitDeployments } from './match-unit-deployments.js';
export { fightData } from './fight-data.js';
