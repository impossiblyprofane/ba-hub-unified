/**
 * Parse a duration string like "30d" or an ISO date into epoch seconds.
 * Used by route handlers for time-windowed queries against endTime (epoch sec).
 */
export function parseSinceToEpochSec(since: string): number {
  const daysMatch = since.match(/^(\d+)d$/);
  if (daysMatch) {
    return Math.floor((Date.now() - Number(daysMatch[1]) * 24 * 60 * 60 * 1000) / 1000);
  }
  return Math.floor(new Date(since).getTime() / 1000);
}
