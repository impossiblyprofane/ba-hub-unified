/**
 * Deck Service — localStorage CRUD for editor decks.
 *
 * All functions are pure (no Qwik dependencies) and operate on
 * the browser's localStorage. Call them from within useVisibleTask$
 * or $() handlers in Qwik components.
 */

import type {
  Deck, Set2, UnitConfig, EditorDeck, NewDeckFormData, DeckStats,
  Set2Key,
} from '@ba-hub/shared';
import { DECK_CATEGORIES, SET2_KEYS } from '@ba-hub/shared';
import { sanitizeEditorDeck } from './deckSanitizer';
import type { BuilderSpecialization, ArsenalCard } from '../graphql-types';

const DECK_PREFIX = 'deck_';
const LAST_DECK_KEY = 'ba_last_deck_id';

// ── Read ────────────────────────────────────────────────────────

/** List all saved editor decks from localStorage. */
export function listDecks(): EditorDeck[] {
  const decks: EditorDeck[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(DECK_PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(atob(raw)) as EditorDeck;
          decks.push(parsed);
        }
      } catch {
        // Skip corrupt entries
      }
    }
  }
  return decks.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/** Get a single deck by its ID. */
export function getDeck(deckId: string): EditorDeck | null {
  try {
    const raw = localStorage.getItem(DECK_PREFIX + deckId);
    if (!raw) return null;
    return JSON.parse(atob(raw)) as EditorDeck;
  } catch {
    return null;
  }
}

// ── Write ───────────────────────────────────────────────────────

/**
 * Save a deck (sanitise first).
 * If arsenalCards is provided, cache total/per-category points for
 * offline display on the deck list page.
 */
export function saveDeck(
  editorDeck: EditorDeck,
  arsenalCards?: Map<number, ArsenalCard>,
): EditorDeck {
  if (arsenalCards && arsenalCards.size > 0) {
    const stats = computeDeckStats(editorDeck, arsenalCards);
    editorDeck.cachedTotalPoints = stats.totalPoints;
    const catPts = {} as Record<Set2Key, number>;
    for (const k of SET2_KEYS) catPts[k] = stats.categoryStats[k].currentPoints;
    editorDeck.cachedCategoryPoints = catPts;
  }
  const { deck: sanitised } = sanitizeEditorDeck(editorDeck);
  const toStore = { ...sanitised, updatedAt: new Date().toISOString() };
  localStorage.setItem(DECK_PREFIX + toStore.deckId, btoa(JSON.stringify(toStore)));
  return toStore;
}

/** Delete a deck. */
export function deleteDeck(deckId: string): void {
  localStorage.removeItem(DECK_PREFIX + deckId);
}

/** Purge all decks. */
export function purgeAllDecks(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(DECK_PREFIX)) keysToRemove.push(key);
  }
  for (const key of keysToRemove) localStorage.removeItem(key);
  localStorage.removeItem(LAST_DECK_KEY);
}

// ── Last used ───────────────────────────────────────────────────

export function getLastUsedDeckId(): string | null {
  return localStorage.getItem(LAST_DECK_KEY);
}

export function setLastUsedDeckId(deckId: string): void {
  localStorage.setItem(LAST_DECK_KEY, deckId);
}

// ── Create ──────────────────────────────────────────────────────

/** Compute max slots for each category from two specializations. Hard-capped at 7. */
function computeMaxSlots(
  spec1: BuilderSpecialization,
  spec2: BuilderSpecialization,
): Record<Set2Key, number> {
  const result = {} as Record<Set2Key, number>;
  for (const cat of DECK_CATEGORIES) {
    const s1 = (spec1 as unknown as Record<string, number>)[cat.slotsField] ?? 0;
    const s2 = (spec2 as unknown as Record<string, number>)[cat.slotsField] ?? 0;
    result[cat.set2Key] = Math.min(s1 + s2, 7);
  }
  return result;
}

/** Compute max points for each category from two specializations. */
function computeMaxPoints(
  spec1: BuilderSpecialization,
  spec2: BuilderSpecialization,
): Record<Set2Key, number> {
  const result = {} as Record<Set2Key, number>;
  for (const cat of DECK_CATEGORIES) {
    const p1 = (spec1 as unknown as Record<string, number>)[cat.pointsField] ?? 0;
    const p2 = (spec2 as unknown as Record<string, number>)[cat.pointsField] ?? 0;
    result[cat.set2Key] = p1 + p2;
  }
  return result;
}

/** Build an empty Set2 with placeholder slots. */
function emptySet2(maxSlots: Record<Set2Key, number>): Set2 {
  const set2 = {} as Record<Set2Key, UnitConfig[]>;
  for (const key of SET2_KEYS) {
    const slots: UnitConfig[] = [];
    const count = maxSlots[key] ?? 0;
    for (let i = 0; i < count; i++) {
      slots.push({ cat: 0, slot: i, modList: [], modListTr: [] });
    }
    set2[key] = slots;
  }
  return set2 as unknown as Set2;
}

/** Create a brand-new EditorDeck from the wizard form data. */
export function createDeck(
  form: NewDeckFormData,
  spec1: BuilderSpecialization,
  spec2: BuilderSpecialization,
  meta?: { countryName?: string; countryFlag?: string },
): EditorDeck {
  const deckId = Date.now().toString();
  const maxSlots = computeMaxSlots(spec1, spec2);
  const maxPoints = computeMaxPoints(spec1, spec2);
  const now = new Date().toISOString();

  const deck: Deck = {
    v: 0,
    name: form.name,
    country: form.countryId,
    spec1: form.spec1Id,
    spec2: form.spec2Id,
    set2: emptySet2(maxSlots),
  };

  return {
    deckId,
    deck,
    deckMaxPoints: maxPoints,
    deckMaxSlots: maxSlots,
    createdAt: now,
    updatedAt: now,
    countryName: meta?.countryName,
    countryFlag: meta?.countryFlag,
    spec1UIName: spec1.UIName,
    spec2UIName: spec2.UIName,
    spec1Icon: spec1.Icon,
    spec2Icon: spec2.Icon,
  };
}

/**
 * Create an EditorDeck from an already-hydrated Deck (e.g. decoded from a
 * shared deck code).  Reuses the same maxSlots/maxPoints computation as
 * createDeck, but populates `set2` from the provided deck instead of
 * building empty slots.
 */
export function createDeckFromImport(
  deck: Deck,
  spec1: BuilderSpecialization,
  spec2: BuilderSpecialization,
  meta?: { countryName?: string; countryFlag?: string },
): EditorDeck {
  const deckId = Date.now().toString();
  const maxSlots = computeMaxSlots(spec1, spec2);
  const maxPoints = computeMaxPoints(spec1, spec2);
  const now = new Date().toISOString();

  // Pad each category's unit array to maxSlots with empty placeholder slots
  const paddedSet2 = {} as Record<Set2Key, UnitConfig[]>;
  for (const key of SET2_KEYS) {
    const units: UnitConfig[] = [...((deck.set2 as unknown as Record<string, UnitConfig[]>)[key] ?? [])];
    const max = maxSlots[key] ?? 0;
    // Re-index slots and fill category index
    const catIdx = DECK_CATEGORIES.findIndex(c => c.set2Key === key);
    for (let i = 0; i < units.length; i++) {
      units[i] = { ...units[i], slot: i, cat: catIdx >= 0 ? catIdx : 0 };
    }
    while (units.length < max) {
      units.push({ cat: catIdx >= 0 ? catIdx : 0, slot: units.length, modList: [], modListTr: [] });
    }
    paddedSet2[key] = units.slice(0, max);
  }

  const finalDeck: Deck = {
    ...deck,
    set2: paddedSet2 as unknown as Set2,
  };

  return {
    deckId,
    deck: finalDeck,
    deckMaxPoints: maxPoints,
    deckMaxSlots: maxSlots,
    createdAt: now,
    updatedAt: now,
    countryName: meta?.countryName,
    countryFlag: meta?.countryFlag,
    spec1UIName: spec1.UIName,
    spec2UIName: spec2.UIName,
    spec1Icon: spec1.Icon,
    spec2Icon: spec2.Icon,
  };
}

// ── Stats ───────────────────────────────────────────────────────

/** Compute the cost of a single UnitConfig (unit + transport mods). */
export function computeUnitCost(
  unit: UnitConfig,
  arsenalCards: Map<number, ArsenalCard>,
): number {
  if (!unit.unitId || !unit.count) return 0;

  const card = arsenalCards.get(unit.unitId);
  const baseCost = card?.unit.Cost ?? 0;
  const modCost = unit.modList.reduce((sum, m) => sum + (m.cost ?? 0), 0);
  const unitTotal = (baseCost + modCost) * unit.count;

  let transportTotal = 0;
  if (unit.tranId && unit.tranCount) {
    const tranCard = arsenalCards.get(unit.tranId);
    const tranBase = tranCard?.unit.Cost ?? 0;
    const tranModCost = (unit.modListTr ?? []).reduce((sum, m) => sum + (m.cost ?? 0), 0);
    transportTotal = (tranBase + tranModCost) * unit.tranCount;
  }

  return unitTotal + transportTotal;
}

/** Compute aggregate DeckStats for a complete deck. */
export function computeDeckStats(
  editorDeck: EditorDeck,
  arsenalCards: Map<number, ArsenalCard>,
): DeckStats {
  let totalPoints = 0;
  let totalSlots = 0;
  const categoryStats = {} as DeckStats['categoryStats'];

  for (const key of SET2_KEYS) {
    const units = (editorDeck.deck.set2[key] ?? []) as UnitConfig[];
    const filledUnits = units.filter(u => u.unitId !== undefined);
    let currentPoints = 0;

    for (const u of filledUnits) {
      currentPoints += computeUnitCost(u, arsenalCards);
    }

    let totalAvailability = 0;
    let totalSeats = 0;
    let totalCargo = 0;
    for (const u of filledUnits) {
      const card = u.unitId ? arsenalCards.get(u.unitId) : undefined;
      const count = u.count ?? 0;
      totalAvailability += count;
      // Main unit's own capacity (e.g. APCs in logistics)
      totalSeats += (card?.transportCapacity ?? 0) * count;
      totalCargo += (card?.cargoCapacity ?? 0) * count;
      // Transport vehicle assigned to this slot
      if (u.tranId && u.tranCount) {
        const tranCard = arsenalCards.get(u.tranId);
        totalSeats += (tranCard?.transportCapacity ?? 0) * u.tranCount;
        totalCargo += (tranCard?.cargoCapacity ?? 0) * u.tranCount;
      }
    }

    categoryStats[key] = {
      currentPoints,
      maxPoints: editorDeck.deckMaxPoints[key] ?? 0,
      currentSlots: filledUnits.length,
      maxSlots: editorDeck.deckMaxSlots[key] ?? 0,
      unitCount: totalAvailability,
      totalAvailability,
      totalSeats,
      totalCargo,
    };

    totalPoints += currentPoints;
    totalSlots += filledUnits.length;
  }

  return { totalPoints, totalSlots, categoryStats };
}

// ── Display name resolution ─────────────────────────────────────

/** Resolve the display name for a unit config from its mod overrides. */
export function resolveUnitDisplayName(
  unit: UnitConfig,
  baseName: string,
): string {
  let name = baseName;
  for (const mod of unit.modList) {
    if (mod.run) name = mod.run;
    if (mod.cwun) name = `${name} ${mod.cwun}`;
  }
  return name;
}

/** Resolve the display name for a transport config from its mod overrides. */
export function resolveTransportDisplayName(
  unit: UnitConfig,
  baseName: string,
): string {
  let name = baseName;
  for (const mod of (unit.modListTr ?? [])) {
    if (mod.run) name = mod.run;
    if (mod.cwun) name = `${name} ${mod.cwun}`;
  }
  return name;
}

// ── Duplicate ───────────────────────────────────────────────────

/** Create a deep copy of an EditorDeck with a new ID and name. */
export function duplicateDeck(source: EditorDeck, newName?: string): EditorDeck {
  const now = new Date().toISOString();
  const copy: EditorDeck = JSON.parse(JSON.stringify(source));
  copy.deckId = Date.now().toString();
  copy.deck.name = newName ?? `${source.deck.name} (Copy)`;
  copy.createdAt = now;
  copy.updatedAt = now;
  return copy;
}
