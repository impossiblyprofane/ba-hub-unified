/**
 * Published deck types — shared between database service, backend, and frontend.
 *
 * A published deck is a snapshot clone of a local EditorDeck, stored server-side
 * for browsing, sharing, likes, and views.
 */

import type { CompressedDeck } from './deck.js';

// ── Deck tags ───────────────────────────────────────────────────

/** Tag group categories. */
export type DeckTagGroup = 'Mode' | 'TeamSize' | 'Playstyle' | 'Composition' | 'StrategyTempo' | 'Other';

/** All valid predefined tags for a published deck. */
export const DECK_TAGS = [
  // Mode
  'Casual', 'Competitive', 'Solo', 'Duo', 'TeamPlay', 'PvE',
  // Team Size
  '1v1', '2v2', '3v3', '4v4', '5v5',
  // Playstyle
  'Aggressive', 'Defensive', 'Support', 'Frontline', 'Skirmish',
  'Urban', 'Forest', 'Open', 'SmokeHeavy',
  // Composition
  'CombinedArms', 'Heavy', 'Mid', 'Light', 'CQC',
  'Artillery', 'CAS', 'Strike',
  // Strategy & Tempo
  'Rush', 'Spam', 'Timing', 'Late', 'Slow', 'Micro',
  'Harassment', 'Paradrop', 'MapControl', 'Attrition',
  'SEAD', 'AllIn', 'Flexible',
  // Other
  'Meta', 'AntiMeta', 'Balanced', 'Experimental',
  'BeginnerFriendly', 'Meme', 'LowAPM',
] as const;

/** A single tag value. */
export type DeckTag = (typeof DECK_TAGS)[number];

/** Grouped tag definitions for UI rendering. */
export const DECK_TAG_GROUPS: { group: DeckTagGroup; i18nKey: string; tags: DeckTag[] }[] = [
  { group: 'Mode',          i18nKey: 'decks.tagGroup.mode',          tags: ['Casual', 'Competitive', 'Solo', 'Duo', 'TeamPlay', 'PvE'] },
  { group: 'TeamSize',      i18nKey: 'decks.tagGroup.teamSize',      tags: ['1v1', '2v2', '3v3', '4v4', '5v5'] },
  { group: 'Playstyle',     i18nKey: 'decks.tagGroup.playstyle',     tags: ['Aggressive', 'Defensive', 'Support', 'Frontline', 'Skirmish', 'Urban', 'Forest', 'Open', 'SmokeHeavy'] },
  { group: 'Composition',   i18nKey: 'decks.tagGroup.composition',   tags: ['CombinedArms', 'Heavy', 'Mid', 'Light', 'CQC', 'Artillery', 'CAS', 'Strike'] },
  { group: 'StrategyTempo', i18nKey: 'decks.tagGroup.strategyTempo', tags: ['Rush', 'Spam', 'Timing', 'Late', 'Slow', 'Micro', 'Harassment', 'Paradrop', 'MapControl', 'Attrition', 'SEAD', 'AllIn', 'Flexible'] },
  { group: 'Other',         i18nKey: 'decks.tagGroup.other',         tags: ['Meta', 'AntiMeta', 'Balanced', 'Experimental', 'BeginnerFriendly', 'Meme', 'LowAPM'] },
];

/** i18n key map for tag display names. */
export const DECK_TAG_I18N: Record<DeckTag, string> = {
  // Mode
  Casual: 'decks.tags.casual',
  Competitive: 'decks.tags.competitive',
  Solo: 'decks.tags.solo',
  Duo: 'decks.tags.duo',
  TeamPlay: 'decks.tags.teamPlay',
  PvE: 'decks.tags.pve',
  // Team Size
  '1v1': 'decks.tags.1v1',
  '2v2': 'decks.tags.2v2',
  '3v3': 'decks.tags.3v3',
  '4v4': 'decks.tags.4v4',
  '5v5': 'decks.tags.5v5',
  // Playstyle
  Aggressive: 'decks.tags.aggressive',
  Defensive: 'decks.tags.defensive',
  Support: 'decks.tags.support',
  Frontline: 'decks.tags.frontline',
  Skirmish: 'decks.tags.skirmish',
  Urban: 'decks.tags.urban',
  Forest: 'decks.tags.forest',
  Open: 'decks.tags.open',
  SmokeHeavy: 'decks.tags.smokeHeavy',
  // Composition
  CombinedArms: 'decks.tags.combinedArms',
  Heavy: 'decks.tags.heavy',
  Mid: 'decks.tags.mid',
  Light: 'decks.tags.light',
  CQC: 'decks.tags.cqc',
  Artillery: 'decks.tags.artillery',
  CAS: 'decks.tags.cas',
  Strike: 'decks.tags.strike',
  // Strategy & Tempo
  Rush: 'decks.tags.rush',
  Spam: 'decks.tags.spam',
  Timing: 'decks.tags.timing',
  Late: 'decks.tags.late',
  Slow: 'decks.tags.slow',
  Micro: 'decks.tags.micro',
  Harassment: 'decks.tags.harassment',
  Paradrop: 'decks.tags.paradrop',
  MapControl: 'decks.tags.mapControl',
  Attrition: 'decks.tags.attrition',
  SEAD: 'decks.tags.sead',
  AllIn: 'decks.tags.allIn',
  Flexible: 'decks.tags.flexible',
  // Other
  Meta: 'decks.tags.meta',
  AntiMeta: 'decks.tags.antiMeta',
  Balanced: 'decks.tags.balanced',
  Experimental: 'decks.tags.experimental',
  BeginnerFriendly: 'decks.tags.beginnerFriendly',
  Meme: 'decks.tags.meme',
  LowAPM: 'decks.tags.lowAPM',
};

// ── Published deck ──────────────────────────────────────────────

/** A published deck as returned by the API. */
export interface PublishedDeck {
  id: string;          // UUID v4
  /** Whether the current viewer is the author of this deck. */
  isOwner: boolean;
  /** Display name chosen by the publisher. */
  publisherName: string;
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
  /** Whether the current viewer is the author of this deck. */
  isOwner: boolean;
  /** Display name chosen by the publisher. */
  publisherName: string;
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

// ── Internal database types (not exposed to frontend) ───────────

/**
 * Raw deck as returned by the database REST API.
 * Includes `authorId` for server-side ownership checks.
 * The backend resolvers strip `authorId` and compute `isOwner` before
 * returning the public `PublishedDeck` / `PublishedDeckSummary` to clients.
 */
export interface RawPublishedDeck extends Omit<PublishedDeck, 'isOwner'> {
  authorId: string;
}

export interface RawPublishedDeckSummary extends Omit<PublishedDeckSummary, 'isOwner'> {
  authorId: string;
}

/** Browse result with raw summaries (includes authorId). */
export interface RawBrowseDecksResult extends Omit<BrowseDecksResult, 'decks'> {
  decks: RawPublishedDeckSummary[];
}

// ── Input types ─────────────────────────────────────────────────

/** Request body when publishing a new deck. */
export interface PublishDeckInput {
  authorId: string;
  /** Display name chosen by the publisher. */
  publisherName: string;
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
  /** Display name chosen by the publisher. */
  publisherName?: string;
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
