import type { SteamProfile } from '~/lib/graphql-types';

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

type GraphQLResponse = {
  data?: { steamProfiles?: SteamProfile[] };
  errors?: Array<{ message: string }>;
};

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

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    chunks.push(unique.slice(i, i + CHUNK_SIZE));
  }

  const responses = await Promise.all(
    chunks.map((chunk) =>
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: STEAM_PROFILES_QUERY,
          variables: { steamIds: chunk },
        }),
      })
        .then((res) => (res.ok ? (res.json() as Promise<GraphQLResponse>) : null))
        .catch(() => null),
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
