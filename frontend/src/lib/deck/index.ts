/**
 * Deck library barrel — re-exports for the deck builder feature.
 */

// ── Encoder ─────────────────────────────────────────────────────
export {
  encodeDeck,
  decodeDeck,
  decodeDeckMeta,
  compressedToDeck,
} from './deckEncoder';

// ── Sanitizer ───────────────────────────────────────────────────
export {
  sanitizeDeck,
  sanitizeEditorDeck,
} from './deckSanitizer';

// ── Service (localStorage CRUD) ─────────────────────────────────
export {
  listDecks,
  getDeck,
  saveDeck,
  deleteDeck,
  purgeAllDecks,
  createDeck,
  createDeckFromImport,
  duplicateDeck,
  getLastUsedDeckId,
  setLastUsedDeckId,
  computeUnitCost,
  computeDeckStats,
  resolveUnitDisplayName,
  resolveTransportDisplayName,
} from './deckService';
