import type { PageMeta } from '../types';

/**
 * Stats system was torn out on the dev branch — `analyticsFightData` no longer
 * exists in the GraphQL schema. Until the rework lands, return a generic fallback
 * so crawlers don't get a half-broken embed. See docs/stats-rework-handoff.md.
 */
export async function resolveMatchMeta(_fightId: string): Promise<PageMeta> {
  return {
    title: 'BA HUB - Match Detail',
    description: 'View detailed match statistics and player performance for a Broken Arrow match.',
  };
}
