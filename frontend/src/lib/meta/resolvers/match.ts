import type { PageMeta } from '../types';
import { fetchGraphQL } from '../utils/graphql';
import { buildMapImageUrl } from '../utils/map-images';

const FIGHT_EMBED_QUERY = `
  query FightEmbed($fightId: String!) {
    analyticsFightData(fightId: $fightId) { mapName totalPlayTimeSec players { name teamId oldRating newRating } }
  }
`;

interface EmbedFightPlayer { name: string | null; teamId: number | null; oldRating: number | null; newRating: number | null }
interface EmbedFight { mapName: string | null; totalPlayTimeSec: number | null; players: EmbedFightPlayer[] }

export async function resolveMatchMeta(fightId: string): Promise<PageMeta> {
  const data = await fetchGraphQL<{ analyticsFightData: EmbedFight | null }>(FIGHT_EMBED_QUERY, { fightId });
  const fight = data?.analyticsFightData;
  if (fight) {
    const mapName = fight.mapName ?? 'Unknown Map';
    const parts: string[] = [mapName];
    const pc = fight.players.length;
    if (pc >= 2) parts.push(`${Math.ceil(pc / 2)}v${Math.floor(pc / 2)}`);
    if (fight.totalPlayTimeSec) parts.push(`${Math.floor(fight.totalPlayTimeSec / 60)}m`);
    const winners: string[] = [], losers: string[] = [];
    for (const p of fight.players) {
      const name = p.name ?? 'Unknown';
      if (p.oldRating != null && p.newRating != null) {
        (p.newRating >= p.oldRating ? winners : losers).push(name);
      }
    }
    const fmt = (n: string[]) => n.length > 3 ? `${n.slice(0, 3).join(', ')}, ...` : n.join(', ');
    if (winners.length && losers.length) parts.push(`Victory: ${fmt(winners)} vs Defeat: ${fmt(losers)}`);
    return { title: `${mapName} — BA Hub Match Detail`, description: parts.join(' · '), ogImage: buildMapImageUrl(fight.mapName) };
  }
  return { title: 'Match Detail - BA Hub', description: 'View detailed match statistics for Broken Arrow.' };
}
