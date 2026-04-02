import type { PageMeta } from '../types';
import { fetchGraphQL } from '../utils/graphql';

const DECK_EMBED_QUERY = `
  query DeckEmbed($id: String!) { publishedDeck(id: $id) { name description likeCount viewCount } }
`;

export async function resolveDeckMeta(deckId: string): Promise<PageMeta> {
  const data = await fetchGraphQL<{ publishedDeck: { name: string; description: string; likeCount: number; viewCount: number } | null }>(DECK_EMBED_QUERY, { id: deckId });
  const deck = data?.publishedDeck;
  if (deck) {
    return { title: `${deck.name} — BA Hub Deck`, description: deck.description || `Community deck: ${deck.name}. ${deck.likeCount} likes, ${deck.viewCount} views.` };
  }
  return { title: 'Published Deck - BA Hub', description: 'View a community-published deck with full composition details.' };
}
