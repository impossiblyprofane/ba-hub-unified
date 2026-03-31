/**
 * Published deck types — shared between database service, backend, and frontend.
 *
 * A published deck is a snapshot clone of a local EditorDeck, stored server-side
 * for browsing, sharing, likes, and views.
 */

import type { CompressedDeck } from './deck.js';

// ── Deck tags ───────────────────────────────────────────────────

/** All valid predefined tags for a published deck. */
export const DECK_TAGS = [
  'Meta',
  'Meme',
  'Beginner',
  'Competitive',
  'DLC',
  'Cheese',
  'AllRounder',
  'Rush',
  'Defensive',
  'CombinedArms',
] as const;

/** A single tag value. */
export type DeckTag = (typeof DECK_TAGS)[number];

/** i18n key map for tag display names. */
export const DECK_TAG_I18N: Record<DeckTag, string> = {
  Meta: 'deckPublish.tags.meta',
  Meme: 'deckPublish.tags.meme',
  Beginner: 'deckPublish.tags.beginner',
  Competitive: 'deckPublish.tags.competitive',
  DLC: 'deckPublish.tags.dlc',
  Cheese: 'deckPublish.tags.cheese',
  AllRounder: 'deckPublish.tags.allRounder',
  Rush: 'deckPublish.tags.rush',
  Defensive: 'deckPublish.tags.defensive',
  CombinedArms: 'deckPublish.tags.combinedArms',
};

// ── Published deck ──────────────────────────────────────────────

/** A published deck as returned by the API. */
export interface PublishedDeck {
  id: string;          // UUID v4
  authorId: string;    // User.id
  name: string;
  description: string;
  deckCode: string;    // Encoded deck string
  countryId: number;
  spec1Id: number;
  spec2Id: number;
  /** Full deck data for server-side filtering / display. */
  deckData: CompressedDeck;
  tags: DeckTag[];
  viewCount: number;
  likeCount: number;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
}

/** Summary card for browse listings (lighter than full PublishedDeck). */
export interface PublishedDeckSummary {
  id: string;
  authorId: string;
  name: string;
  description: string;
  deckCode: string;
  countryId: number;
  spec1Id: number;
  spec2Id: number;
  tags: DeckTag[];
  viewCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}

// ── Input types ─────────────────────────────────────────────────

/** Request body when publishing a new deck. */
export interface PublishDeckInput {
  authorId: string;
  name: string;
  description: string;
  deckCode: string;
  countryId: number;
  spec1Id: number;
  spec2Id: number;
  deckData: CompressedDeck;
  tags: DeckTag[];
  /** Challenge answer for abuse prevention. */
  challengeId: string;
  challengeAnswer: number;
}

/** Request body when updating an existing published deck. */
export interface UpdatePublishedDeckInput {
  name?: string;
  description?: string;
  deckCode?: string;
  deckData?: CompressedDeck;
  tags?: DeckTag[];
  /** Challenge answer for abuse prevention. */
  challengeId: string;
  challengeAnswer: number;
}

// ── Browse / filter / sort ──────────────────────────────────────

/** Sort options for the browse page. */
export type BrowseDeckSort =
  | 'recent'
  | 'popular'
  | 'mostLiked';

/** Filter criteria for browsing published decks. */
export interface BrowseDecksFilter {
  countryId?: number;
  spec1Id?: number;
  spec2Id?: number;
  tags?: DeckTag[];
  search?: string;     // Full-text search on name + description
  authorId?: string;   // Filter by author
  sort?: BrowseDeckSort;
  page?: number;       // 1-based
  pageSize?: number;   // Default 20, max 50
}

/** Paginated browse result. */
export interface BrowseDecksResult {
  decks: PublishedDeckSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Like / view ─────────────────────────────────────────────────

/** Response after toggling a like. */
export interface ToggleLikeResult {
  liked: boolean;
  newLikeCount: number;
}

/** Response after recording a view. */
export interface RecordViewResult {
  newViewCount: number;
}

// ── Challenge (trivial math) ────────────────────────────────────

/** Server-generated challenge for abuse prevention. */
export interface TrivialChallenge {
  challengeId: string;
  /** Human-readable question, e.g. "What is 7 + 3?" */
  question: string;
}

// ── Deletion ────────────────────────────────────────────────────

/** Request body for deleting a published deck. */
export interface DeletePublishedDeckInput {
  authorId: string;
  challengeId: string;
  challengeAnswer: number;
}
