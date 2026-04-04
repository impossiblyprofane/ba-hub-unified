import type { PageMeta } from '../types.js';
import { fetchGraphQL } from '../utils/graphql.js';
import { buildMapImageUrl } from '../utils/map-images.js';

const FIGHT_EMBED_QUERY = `
  query FightEmbed($fightId: String!) {
    analyticsFightData(fightId: $fightId) {
      mapName
      totalPlayTimeSec
      players { name teamId oldRating newRating }
    }
  }
`;

interface EmbedFightPlayer {
  name: string | null;
  teamId: number | null;
  oldRating: number | null;
  newRating: number | null;
}

interface EmbedFight {
  mapName: string | null;
  totalPlayTimeSec: number | null;
  players: EmbedFightPlayer[];
}

function buildFightDescription(fight: EmbedFight): string {
  const mapName = fight.mapName ?? 'Unknown Map';
  const parts: string[] = [mapName];

  // Team size
  const pc = fight.players.length;
  if (pc >= 2) parts.push(`${Math.ceil(pc / 2)}v${Math.floor(pc / 2)}`);

  // Duration
  if (fight.totalPlayTimeSec) {
    parts.push(`${Math.floor(fight.totalPlayTimeSec / 60)}m`);
  }

  // Determine teams by rating change direction
  const winners: string[] = [];
  const losers: string[] = [];
  for (const p of fight.players) {
    const name = p.name ?? 'Unknown';
    if (p.oldRating != null && p.newRating != null) {
      if (p.newRating >= p.oldRating) winners.push(name);
      else losers.push(name);
    }
  }

  // Build team strings (max 3 names each)
  const fmt = (names: string[]) =>
    names.length > 3 ? `${names.slice(0, 3).join(', ')}, ...` : names.join(', ');

  if (winners.length > 0 && losers.length > 0) {
    parts.push(`Victory: ${fmt(winners)} vs Defeat: ${fmt(losers)}`);
  }

  return parts.join(' · ');
}

export async function resolveMatchMeta(fightId: string): Promise<PageMeta> {
  const data = await fetchGraphQL<{ analyticsFightData: EmbedFight | null }>(
    FIGHT_EMBED_QUERY,
    { fightId },
  );
  const fight = data?.analyticsFightData;

  if (fight) {
    const mapName = fight.mapName ?? 'Match';
    return {
      title: `BA HUB - Match on ${mapName}`,
      description: buildFightDescription(fight),
      ogImage: buildMapImageUrl(fight.mapName),
    };
  }

  return {
    title: 'BA HUB - Match Detail',
    description: 'View detailed match statistics and player performance for a Broken Arrow match.',
  };
}
