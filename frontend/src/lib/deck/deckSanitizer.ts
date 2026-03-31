/**
 * Deck Sanitizer — validates and normalises deck data.
 *
 * Ported from the legacy deckSanitizer.ts with the same rules:
 * - Strip invalid unit configs (missing/NaN unitId)
 * - Normalise arrays and numeric fields
 * - Remove transport fields when transport is invalid
 * - Fill remaining empty slots up to maxSlots
 */

import type { Deck, EditorDeck, Set2, UnitConfig, Set2Key } from '@ba-hub/shared';

// Re-import the constant because `SET2_KEYS` is a value export
const ALL_KEYS: Set2Key[] = [
  'Recon', 'Infantry', 'GroundCombatVehicles', 'Support',
  'Logistic', 'Helicopters', 'Aircrafts',
];

function sanitizeUnitConfig(unitConfig: UnitConfig): { unit: UnitConfig | null; changed: boolean } {
  if (!unitConfig || typeof unitConfig.unitId !== 'number' || !Number.isFinite(unitConfig.unitId)) {
    // Keep empty placeholder slots (unitId === undefined)
    if (unitConfig && unitConfig.unitId === undefined) {
      return { unit: unitConfig, changed: false };
    }
    return { unit: null, changed: true };
  }

  let changed = false;

  const normalised: UnitConfig = {
    ...unitConfig,
    modList: Array.isArray(unitConfig.modList) ? unitConfig.modList : [],
    modListTr: Array.isArray(unitConfig.modListTr) ? unitConfig.modListTr : [],
    count: typeof unitConfig.count === 'number' && Number.isFinite(unitConfig.count)
      ? unitConfig.count
      : 0,
  };

  if (!Array.isArray(unitConfig.modList) || !Array.isArray(unitConfig.modListTr)) changed = true;
  if (!(typeof unitConfig.count === 'number' && Number.isFinite(unitConfig.count))) changed = true;

  // Transport: only include if valid (> 0)
  const hasValidTranId =
    typeof unitConfig.tranId === 'number' &&
    Number.isFinite(unitConfig.tranId) &&
    unitConfig.tranId > 0;
  const hasValidTranCount =
    typeof unitConfig.tranCount === 'number' &&
    Number.isFinite(unitConfig.tranCount) &&
    unitConfig.tranCount > 0;

  const withTransport: UnitConfig = {
    ...normalised,
    ...(hasValidTranId ? { tranId: unitConfig.tranId } : {}),
    ...(hasValidTranId && hasValidTranCount ? { tranCount: unitConfig.tranCount } : {}),
    ...(hasValidTranId ? {} : { modListTr: [] }),
  };

  if (!hasValidTranId && unitConfig.tranId !== undefined) changed = true;
  if (!hasValidTranCount && unitConfig.tranCount !== undefined) changed = true;
  if (!hasValidTranId && Array.isArray(unitConfig.modListTr) && unitConfig.modListTr.length > 0) changed = true;

  return { unit: withTransport, changed };
}

/** Create an empty placeholder slot. */
function emptySlot(cat: number, slot: number): UnitConfig {
  return { cat, slot, modList: [], modListTr: [] };
}

export function sanitizeDeck(editorDeck: EditorDeck, deck: Deck): { deck: Deck; changed: boolean } {
  let changed = false;
  const sanitisedSet2 = { ...deck.set2 } as Record<Set2Key, UnitConfig[]>;

  for (const category of ALL_KEYS) {
    const maxSlots = editorDeck.deckMaxSlots[category] ?? 0;
    const units = (deck.set2[category] || []) as UnitConfig[];
    const sanitised: UnitConfig[] = [];

    for (const unitConfig of units) {
      const { unit, changed: unitChanged } = sanitizeUnitConfig(unitConfig);
      if (unitChanged) changed = true;
      if (unit) sanitised.push(unit);
    }

    if (sanitised.length !== units.length) changed = true;

    // Fill remaining slots with empty placeholders
    const slotCount = sanitised.length;
    if (slotCount < maxSlots) {
      changed = true;
      for (let i = slotCount; i < maxSlots; i++) {
        sanitised.push(emptySlot(0, i));
      }
    }

    sanitisedSet2[category] = sanitised;
  }

  if (!changed) return { deck, changed: false };

  return {
    deck: { ...deck, set2: sanitisedSet2 as unknown as Set2 },
    changed: true,
  };
}

export function sanitizeEditorDeck(editorDeck: EditorDeck): { deck: EditorDeck; changed: boolean } {
  const { deck: sanitisedInner, changed } = sanitizeDeck(editorDeck, editorDeck.deck);
  if (!changed) return { deck: editorDeck, changed: false };
  return {
    deck: {
      ...editorDeck,
      deck: sanitisedInner,
      updatedAt: new Date().toISOString(),
    },
    changed: true,
  };
}
