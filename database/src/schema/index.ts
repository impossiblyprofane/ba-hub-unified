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

// ── Match crawler tables ──
export { crawlerState } from './crawler-state.js';
export { processedMatches } from './processed-matches.js';
export { matchTeamResults } from './match-team-results.js';
export { matchPlayerPicks } from './match-player-picks.js';
export { matchUnitDeployments } from './match-unit-deployments.js';

// ── Crawler-derived snapshot tables ──
export { crawlerFactionSnapshots } from './crawler-faction-snapshots.js';
export { specStatsSnapshots } from './spec-stats-snapshots.js';
export { unitPerformanceSnapshots } from './unit-performance-snapshots.js';
