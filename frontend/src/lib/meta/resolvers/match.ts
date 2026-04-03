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
    const pc = fight.players.length;
    const teamSize = pc >= 2 ? `${Math.ceil(pc / 2)}v${Math.floor(pc / 2)}` : `${pc}p`;
    const duration = fight.totalPlayTimeSec ? `${Math.floor(fight.totalPlayTimeSec / 60)}min` : '';

    // Determine winners/losers by rating change
    const winners: string[] = [];
    const losers: string[] = [];
    for (const p of fight.players) {
      const name = p.name ?? 'Unknown';
      if (p.oldRating != null && p.newRating != null) {
        (p.newRating >= p.oldRating ? winners : losers).push(name);
      }
    }

    // Build readable description
    const header = [teamSize, duration].filter(Boolean).join(' · ');
    const fmt = (names: string[]) =>
      names.length > 4 ? `${names.slice(0, 4).join(', ')} +${names.length - 4}` : names.join(', ');

    let desc = header;
    if (winners.length && losers.length) {
      desc += ` — Win: ${fmt(winners)} | Loss: ${fmt(losers)}`;
    }

    return {
      title: `${mapName} — BA Hub Match`,
      description: desc,
      ogImage: buildMapImageUrl(fight.mapName),
      twitterCard: 'summary',
    };
  }
  return { title: 'Match Detail - BA Hub', description: 'View detailed match statistics for Broken Arrow.' };
}
