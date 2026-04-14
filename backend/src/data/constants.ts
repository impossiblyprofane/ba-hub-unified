/**
 * Shared constants used across the backend — resolvers, crawler, collector.
 *
 * MapId (numeric, from fight JSON) → human-readable map name.
 * Derived by correlating /statistic/mapsrating (sv_play_map_N) with
 * /statistic/matches/teamsides (readable names) sorted by play count.
 * Updated: 2025-01-30 — covers all current ranked maps.
 */
export const MAP_ID_TO_NAME: Record<number, string> = {
  1: 'Test_map',
  3: 'Baltiisk',
  4: 'Coast',
  5: 'Airport',
  6: 'River',
  7: 'Dam',
  8: 'Tallinn Harbour',
  9: 'Airbase',
  10: 'Frontiers',
  11: 'Central Village',
  12: 'Oil refinery',
  13: 'Suwalki',
  14: 'Jelgava',
  15: 'Narva',
  16: 'Klaipeda',
  17: 'Ruda',
  20: 'Parnu',
  21: 'Chernyakhovsk',
  22: 'Ignalina Powerplant',
  23: 'Kaliningrad',
  25: 'Kadaga Military Base',
};

/** Resolve a numeric map ID to its display name. */
export function resolveMapName(mapId: number | undefined): string | null {
  if (mapId == null) return null;
  return MAP_ID_TO_NAME[mapId] ?? null;
}

/**
 * Parse a duration string like "30d" or an ISO date into epoch seconds.
 * Used by database routes and resolvers for time-windowed queries.
 */
export function parseSinceToEpochSec(since: string): number {
  const daysMatch = since.match(/^(\d+)d$/);
  if (daysMatch) {
    return Math.floor((Date.now() - Number(daysMatch[1]) * 24 * 60 * 60 * 1000) / 1000);
  }
  return Math.floor(new Date(since).getTime() / 1000);
}
