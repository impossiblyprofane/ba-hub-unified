/**
 * Deck Encoder — encode/decode decks to/from shareable string codes.
 *
 * Wire format is **identical** to the legacy ba-hub encoder so codes
 * are cross-compatible between the old and new sites:
 *   country|spec1|spec2|set2  →  XOR cipher  →  base64
 *
 * Numbers are base-36 encoded. Delimiters:
 *   | = top-level parts
 *   ! = categories within set2
 *   # = units within a category
 *   , = fields within a unit
 *   \ = modifications within a unit
 *   / = modId/optId within a modification
 */

import type {
  Deck, Set2, UnitConfig, DeckModification,
  CompressedDeck, CompressedSet2, CompressedUnitConfig, CompressedDeckModification,
} from '@ba-hub/shared';

// XOR cipher key — must match legacy exactly
const DECK_ENCRYPTION_KEY = 'BAHUB_DECK_v2';

// ── Number encoding ─────────────────────────────────────────────

function encodeNumber(num: number): string {
  return num.toString(36);
}

function decodeNumber(str: string): number {
  return parseInt(str, 36);
}

// ── Base64 helpers ──────────────────────────────────────────────

function encodeBase64(str: string): string {
  if (typeof btoa !== 'undefined') return btoa(str);
  return Buffer.from(str).toString('base64');
}

function decodeBase64(str: string): string {
  try {
    if (typeof atob !== 'undefined') return atob(str);
    return Buffer.from(str, 'base64').toString();
  } catch {
    return str;
  }
}

// ── XOR cipher (symmetric) ─────────────────────────────────────

function xorCipher(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(
      str.charCodeAt(i) ^ DECK_ENCRYPTION_KEY.charCodeAt(i % DECK_ENCRYPTION_KEY.length),
    );
  }
  return result;
}

// ── DeckModification codec ──────────────────────────────────────

export function encodeDeckModification(mod: CompressedDeckModification): string {
  return `${encodeNumber(mod.modId)}/${encodeNumber(mod.optId)}`;
}

export function decodeDeckModification(str: string): CompressedDeckModification {
  const [modId, optId] = str.split('/').map(decodeNumber);
  return { modId, optId };
}

// ── UnitConfig codec ────────────────────────────────────────────

export function encodeUnitConfig(unit: CompressedUnitConfig): string {
  const parts = [
    encodeNumber(unit.unitId),
    encodeNumber(unit.count),
    unit.modList.map(encodeDeckModification).join('\\'),
  ];

  if (unit.tranId !== undefined && unit.tranCount !== undefined) {
    const tranModStr = unit.tranModList
      ? unit.tranModList.map(encodeDeckModification).join('\\')
      : '';
    parts.push(encodeNumber(unit.tranId), encodeNumber(unit.tranCount), tranModStr);
  }

  return parts.join(',');
}

export function decodeUnitConfig(str: string): CompressedUnitConfig {
  const parts = str.split(',');
  const [unitIdStr, countStr, modListStr, tranIdStr, tranCountStr, tranModListStr] = parts;

  const config: CompressedUnitConfig = {
    unitId: decodeNumber(unitIdStr),
    count: decodeNumber(countStr),
    modList: modListStr
      ? modListStr.split('\\').filter(m => m !== '').map(decodeDeckModification)
      : [],
  };

  if (tranIdStr !== undefined && tranCountStr !== undefined) {
    config.tranId = decodeNumber(tranIdStr);
    config.tranCount = decodeNumber(tranCountStr);
    config.tranModList = tranModListStr
      ? tranModListStr.split('\\').filter(m => m !== '').map(decodeDeckModification)
      : [];
  }

  return config;
}

// ── Set2 codec ──────────────────────────────────────────────────

export function encodeSet2(set2: CompressedSet2): string {
  const categories = [
    set2.Recon, set2.Infantry, set2.GroundCombatVehicles,
    set2.Support, set2.Logistic, set2.Helicopters, set2.Aircrafts,
  ];
  return categories
    .map(cat => cat.map(encodeUnitConfig).join('#'))
    .join('!');
}

export function decodeSet2(str: string): CompressedSet2 {
  const categories = str.split('!');
  const decode = (idx: number) =>
    categories[idx] ? categories[idx].split('#').map(decodeUnitConfig) : [];

  return {
    Recon: decode(0),
    Infantry: decode(1),
    GroundCombatVehicles: decode(2),
    Support: decode(3),
    Logistic: decode(4),
    Helicopters: decode(5),
    Aircrafts: decode(6),
  };
}

// ── Full ↔ Compressed conversion ────────────────────────────────

export function deckToCompressedDeck(deck: Deck): CompressedDeck {
  return {
    country: deck.country,
    spec1: deck.spec1,
    spec2: deck.spec2,
    set2: fullToCompressedSet2(deck.set2),
  };
}

export function fullToCompressedUnitConfig(unit: UnitConfig): CompressedUnitConfig | null {
  if (!unit.unitId || !unit.count) return null;

  const config: CompressedUnitConfig = {
    unitId: unit.unitId,
    count: unit.count,
    modList: unit.modList.map(mod => ({ modId: mod.modId, optId: mod.optId })),
  };

  if (unit.tranId !== undefined && unit.tranCount !== undefined) {
    config.tranId = unit.tranId;
    config.tranCount = unit.tranCount;
    config.tranModList = unit.modListTr
      ? unit.modListTr.map(mod => ({ modId: mod.modId, optId: mod.optId }))
      : [];
  }

  return config;
}

export function fullToCompressedSet2(fullSet: Set2): CompressedSet2 {
  const compress = (units: UnitConfig[]) =>
    units.map(fullToCompressedUnitConfig).filter((u): u is CompressedUnitConfig => u !== null);

  return {
    Recon: compress(fullSet.Recon),
    Infantry: compress(fullSet.Infantry),
    GroundCombatVehicles: compress(fullSet.GroundCombatVehicles),
    Support: compress(fullSet.Support),
    Logistic: compress(fullSet.Logistic),
    Helicopters: compress(fullSet.Helicopters),
    Aircrafts: compress(fullSet.Aircrafts),
  };
}

/**
 * Hydrate a compressed deck into a full Deck.
 * Requires an options lookup map to resolve cost/run/cwun for each modification.
 */
export function compressedToDeck(
  compressed: CompressedDeck,
  optionsById: Map<number, { Cost?: number; ReplaceUnitName?: string; ConcatenateWithUnitName?: string; ThumbnailOverride?: string | null; PortraitOverride?: string | null }>,
  name?: string,
): Deck {
  const hydrateModList = (mods: CompressedDeckModification[]): DeckModification[] =>
    mods.map(mod => {
      const opt = optionsById.get(mod.optId);
      return {
        modId: mod.modId,
        optId: mod.optId,
        cost: opt?.Cost ?? 0,
        run: opt?.ReplaceUnitName,
        cwun: opt?.ConcatenateWithUnitName,
        type: 0,
        thumbnailOverride: opt?.ThumbnailOverride ?? undefined,
        portraitOverride: opt?.PortraitOverride ?? undefined,
      };
    });

  const hydrateCategory = (units: CompressedUnitConfig[], catIdx: number): UnitConfig[] =>
    units.map((unit, slot) => {
      const config: UnitConfig = {
        unitId: unit.unitId,
        cat: catIdx,
        slot,
        count: unit.count,
        modList: hydrateModList(unit.modList),
      };
      if (unit.tranId !== undefined && unit.tranCount !== undefined) {
        config.tranId = unit.tranId;
        config.tranCount = unit.tranCount;
        config.modListTr = unit.tranModList ? hydrateModList(unit.tranModList) : [];
      }
      return config;
    });

  return {
    country: compressed.country,
    spec1: compressed.spec1,
    spec2: compressed.spec2,
    v: 0,
    name: name || 'Imported Deck',
    set2: {
      Recon: hydrateCategory(compressed.set2.Recon, 0),
      Infantry: hydrateCategory(compressed.set2.Infantry, 1),
      GroundCombatVehicles: hydrateCategory(compressed.set2.GroundCombatVehicles, 2),
      Support: hydrateCategory(compressed.set2.Support, 3),
      Logistic: hydrateCategory(compressed.set2.Logistic, 4),
      Helicopters: hydrateCategory(compressed.set2.Helicopters, 5),
      Aircrafts: hydrateCategory(compressed.set2.Aircrafts, 6),
    },
  };
}

// ── Top-level encode / decode ───────────────────────────────────

export function encodeDeck(deck: Deck): string {
  const compressed = deckToCompressedDeck(deck);
  const parts = [
    encodeNumber(compressed.country),
    encodeNumber(compressed.spec1),
    encodeNumber(compressed.spec2),
    encodeSet2(compressed.set2),
  ];
  const raw = parts.join('|');
  const encrypted = xorCipher(raw);
  return encodeBase64(encrypted);
}

export function decodeDeck(str: string): CompressedDeck | null {
  try {
    // New format: base64 + XOR
    const decoded = decodeBase64(str);
    const decrypted = xorCipher(decoded);
    const [country, spec1, spec2, set2Str] = decrypted.split('|');

    if (country && spec1 && spec2 && set2Str) {
      return {
        country: decodeNumber(country),
        spec1: decodeNumber(spec1),
        spec2: decodeNumber(spec2),
        set2: decodeSet2(set2Str),
      };
    }

    // Fallback: old unencrypted format
    const [oldCountry, oldSpec1, oldSpec2, oldSet2Str] = str.split('|');
    if (oldCountry && oldSpec1 && oldSpec2 && oldSet2Str) {
      return {
        country: decodeNumber(oldCountry),
        spec1: decodeNumber(oldSpec1),
        spec2: decodeNumber(oldSpec2),
        set2: decodeSet2(oldSet2Str),
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Lightweight meta-only decode — extracts country/spec1/spec2 without
 * parsing the full set2 structure. Used for deck list previews.
 */
export function decodeDeckMeta(code: string): { country: number; spec1: number; spec2: number } | null {
  try {
    const decoded = decodeBase64(code.trim());
    const decrypted = xorCipher(decoded);
    const [country, spec1, spec2] = decrypted.split('|');
    if (country && spec1 && spec2) {
      return {
        country: decodeNumber(country),
        spec1: decodeNumber(spec1),
        spec2: decodeNumber(spec2),
      };
    }
    return null;
  } catch {
    return null;
  }
}
