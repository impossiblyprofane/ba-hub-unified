import type { PageMeta } from '../types.js';
import { fetchGraphQL } from '../utils/graphql.js';

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

function buildPlayerDescription(player: EmbedPlayer): string {
  const parts: string[] = [];
  const { user, stats } = player;

  if (user.rank) parts.push(`#${user.rank}`);
  if (user.rating) parts.push(`${Math.round(user.rating)} ELO`);
  if (stats?.fightsCount && stats?.winsCount) {
    parts.push(`${Math.round((stats.winsCount / stats.fightsCount) * 100)}% Win Rate`);
  }
  if (stats?.kdRatio) parts.push(`${stats.kdRatio.toFixed(2)} K/D`);
  if (stats?.fightsCount) parts.push(`${stats.fightsCount} Matches`);

  return parts.length ? parts.join(' · ') : 'Broken Arrow player statistics and match history.';
}

export async function resolvePlayerMeta(steamId: string): Promise<PageMeta> {
  const data = await fetchGraphQL<{ analyticsUserProfile: EmbedPlayer | null }>(
    PLAYER_EMBED_QUERY,
    { steamId },
  );
  const player = data?.analyticsUserProfile;

  if (player) {
    const name = player.user.name ?? 'Player';
    return {
      title: `${name} — BA Hub Player Stats`,
      description: buildPlayerDescription(player),
      ogType: 'profile',
    };
  }

  return {
    title: 'Player Profile - BA Hub',
    description: 'View player statistics, match history, and performance data for Broken Arrow.',
  };
}
