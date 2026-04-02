import type { PageMeta } from '../types.js';
import { fetchGraphQL } from '../utils/graphql.js';

const DECK_EMBED_QUERY = `
  query DeckEmbed($id: String!) {
    publishedDeck(id: $id) {
      name description likeCount viewCount
    }
  }
`;

interface EmbedDeck {
  name: string;
  description: string;
  likeCount: number;
  viewCount: number;
}

export async function resolveDeckMeta(deckId: string): Promise<PageMeta> {
  const data = await fetchGraphQL<{ publishedDeck: EmbedDeck | null }>(
    DECK_EMBED_QUERY,
    { id: deckId },
  );
  const deck = data?.publishedDeck;

  if (deck) {
    return {
      title: `${deck.name} — BA Hub Deck`,
      description: deck.description || `Community deck: ${deck.name}. ${deck.likeCount} likes, ${deck.viewCount} views.`,
    };
  }

  return {
    title: 'Published Deck - BA Hub',
    description: 'View a community-published deck with full composition details.',
  };
}
