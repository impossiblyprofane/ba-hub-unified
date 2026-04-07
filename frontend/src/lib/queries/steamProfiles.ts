import type { SteamProfile } from '~/lib/graphql-types';
import { graphqlFetchRaw } from '~/lib/graphqlClient';

export const STEAM_PROFILES_QUERY = `
  query SteamProfiles($steamIds: [String!]!) {
    steamProfiles(steamIds: $steamIds) {
      steamId
      personaName
      avatarIcon
      avatarMedium
      avatarFull
      profileUrl
    }
  }
`;

/** Backend caps each call at 200 ids. */
const CHUNK_SIZE = 200;

/**
 * Resolve a list of SteamID64s to profile data.
 * Dedupes and chunks in groups of 200 (to match the backend cap), running
 * chunks in parallel. Returns a map keyed by steamId for O(1) lookup by
 * callers. Any id that fails to resolve is simply absent from the map.
 */
export async function fetchSteamProfiles(
  steamIds: string[],
): Promise<Record<string, SteamProfile>> {
  const result: Record<string, SteamProfile> = {};
  const unique = Array.from(new Set(steamIds.filter((id): id is string => !!id)));
  if (unique.length === 0) return result;

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    chunks.push(unique.slice(i, i + CHUNK_SIZE));
  }

  const responses = await Promise.all(
    chunks.map((chunk) =>
      graphqlFetchRaw<{ steamProfiles?: SteamProfile[] }>(
        STEAM_PROFILES_QUERY,
        { steamIds: chunk },
      ).catch(() => null),
    ),
  );

  for (const payload of responses) {
    const rows = payload?.data?.steamProfiles ?? [];
    for (const row of rows) {
      if (row && row.steamId) result[row.steamId] = row;
    }
  }

  return result;
}
