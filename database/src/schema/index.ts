/**
 * Drizzle schema — all tables for the deck publishing system and stats snapshots.
 */

export { users } from './users.js';
export { publishedDecks } from './published-decks.js';
export { deckLikes } from './deck-likes.js';
export { deckViews } from './deck-views.js';
export { challenges } from './challenges.js';

// ── Stats periodic snapshot tables ──
export { statSnapshots } from './stat-snapshots.js';
export { leaderboardSnapshots } from './leaderboard-snapshots.js';
export { mapStatsSnapshots } from './map-stats-snapshots.js';
export { factionStatsSnapshots } from './faction-stats-snapshots.js';
export { unitStatsSnapshots } from './unit-stats-snapshots.js';
