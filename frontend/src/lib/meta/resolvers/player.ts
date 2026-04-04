import type { PageMeta } from '../types';
import { fetchGraphQL } from '../utils/graphql';

const PLAYER_EMBED_QUERY = `
  query PlayerEmbed($steamId: String!) {
    analyticsUserProfile(steamId: $steamId) {
      user { name rating rank ratedGames }
      stats { kdRatio fightsCount winsCount losesCount }
    }
  }
`;

interface EmbedPlayer {
  user: { name: string | null; rating: number | null; rank: number | null; ratedGames: number | null };
  stats: { kdRatio: number | null; fightsCount: number | null; winsCount: number | null; losesCount: number | null } | null;
}

export async function resolvePlayerMeta(steamId: string): Promise<PageMeta> {
  const data = await fetchGraphQL<{ analyticsUserProfile: EmbedPlayer | null }>(PLAYER_EMBED_QUERY, { steamId });
  const player = data?.analyticsUserProfile;
  if (player) {
    const { user, stats } = player;
    const name = user.name ?? 'Player';
    const parts: string[] = [];
    if (user.rank) parts.push(`#${user.rank}`);
    if (user.rating) parts.push(`${Math.round(user.rating)} ELO`);
    if (stats?.fightsCount && stats?.winsCount) parts.push(`${Math.round((stats.winsCount / stats.fightsCount) * 100)}% Win Rate`);
    if (stats?.kdRatio) parts.push(`${stats.kdRatio.toFixed(2)} K/D`);
    if (stats?.fightsCount) parts.push(`${stats.fightsCount} Matches`);
    return { title: `BA HUB - ${name}`, description: parts.length ? parts.join(' · ') : 'Broken Arrow player statistics.', ogType: 'profile' };
  }
  return { title: 'BA HUB - Player Profile', description: 'View player statistics, match history, and performance data for Broken Arrow.' };
}
