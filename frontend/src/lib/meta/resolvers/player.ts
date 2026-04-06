import type { PageMeta } from '../types';

/**
 * Stats system was torn out on the dev branch — `analyticsUserProfile` no longer
 * exists in the GraphQL schema. Until the rework lands, return a generic fallback
 * so crawlers don't get a half-broken embed. See docs/stats-rework-handoff.md.
 */
export async function resolvePlayerMeta(steamId: string): Promise<PageMeta> {
  return {
    title: 'BA HUB - Player Profile',
    description: `View player statistics, match history, and performance data for Broken Arrow (Steam ${steamId}).`,
    ogType: 'profile',
  };
}
