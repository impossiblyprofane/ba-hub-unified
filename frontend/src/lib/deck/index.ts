/**
 * Deck library barrel — re-exports for the deck builder feature.
 */

// ── Encoder ─────────────────────────────────────────────────────
export {
  encodeDeck,
  decodeDeck,
  decodeDeckMeta,
  compressedToDeck,
  deckToCompressedDeck,
} from './deckEncoder';

// ── Sanitizer ───────────────────────────────────────────────────
export {
  sanitizeDeck,
  sanitizeEditorDeck,
} from './deckSanitizer';

// ── .dek game file format ────────────────────────────────────────
export {
  encryptDekFile,
  decryptDekFile,
  downloadDekFile,
} from './dekFile';

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
