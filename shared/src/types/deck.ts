/**
 * Deck data model — mirrors the legacy format for wire-compatibility
 * with existing deck codes (deckEncoder).
 */

// ── Set2 category keys ──────────────────────────────────────────

/** The 7 category keys used inside a deck's Set2 map. */
export type Set2Key =
  | 'Recon'
  | 'Infantry'
  | 'GroundCombatVehicles'
  | 'Support'
  | 'Logistic'
  | 'Helicopters'
  | 'Aircrafts';

/** All Set2 keys in display order (Logistic excluded from editor UI). */
export const SET2_KEYS: Set2Key[] = [
  'Recon',
  'Infantry',
  'GroundCombatVehicles',
  'Support',
  'Logistic',
  'Helicopters',
  'Aircrafts',
];

/** The 6 categories shown in the deck editor grid (excludes Logistic). */
export const EDITOR_CATEGORY_KEYS: Set2Key[] = [
  'Recon',
  'Infantry',
  'GroundCombatVehicles',
  'Support',
  'Helicopters',
  'Aircrafts',
];

/**
 * Maps each Set2 key to the corresponding Specialization field names
 * for slot limits and point budgets, plus the CategoryType enum value
 * used in Unit.CategoryType.
 */
export interface CategoryMapping {
  set2Key: Set2Key;
  slotsField: string;
  pointsField: string;
  /** Unit.CategoryType value — undefined for Logistic (0 in CategoryType). */
  categoryType: number;
  /** Short display code (e.g. "REC", "INF"). */
  code: string;
  /** i18n key for the category label. */
  i18nKey: string;
}

export const DECK_CATEGORIES: CategoryMapping[] = [
  { set2Key: 'Recon', slotsField: 'ReconSlots', pointsField: 'ReconPoints', categoryType: 0, code: 'REC', i18nKey: 'builder.category.recon' },
  { set2Key: 'Infantry', slotsField: 'InfantrySlots', pointsField: 'InfantryPoints', categoryType: 1, code: 'INF', i18nKey: 'builder.category.infantry' },
  { set2Key: 'GroundCombatVehicles', slotsField: 'CombatSlots', pointsField: 'CombatPoints', categoryType: 2, code: 'VEH', i18nKey: 'builder.category.vehicles' },
  { set2Key: 'Support', slotsField: 'SupportSlots', pointsField: 'SupportPoints', categoryType: 3, code: 'SUP', i18nKey: 'builder.category.support' },
  { set2Key: 'Logistic', slotsField: 'LogisticsSlots', pointsField: 'LogisticsPoints', categoryType: 4, code: 'LOG', i18nKey: 'builder.category.logistics' },
  { set2Key: 'Helicopters', slotsField: 'HelicoptersSlots', pointsField: 'HelicoptersPoints', categoryType: 5, code: 'HEL', i18nKey: 'builder.category.helicopters' },
  { set2Key: 'Aircrafts', slotsField: 'AirSlots', pointsField: 'AirPoints', categoryType: 6, code: 'AIR', i18nKey: 'builder.category.aircraft' },
];

// ── Core deck types ─────────────────────────────────────────────

/** A complete deck as persisted and encoded in deck codes. */
export interface Deck {
  set2: Set2;
  v: number;
  name: string;
  spec1: number;
  spec2: number;
  country: number;
}

/** Category → unit list mapping inside a deck. */
export interface Set2 {
  Recon: UnitConfig[];
  Infantry: UnitConfig[];
  GroundCombatVehicles: UnitConfig[];
  Support: UnitConfig[];
  Logistic: UnitConfig[];
  Helicopters: UnitConfig[];
  Aircrafts: UnitConfig[];
}

/** A single unit slot within a deck category. */
export interface UnitConfig {
  /** Unit.Id — undefined for empty slots. */
  unitId?: number;
  /** Category index (legacy compat). */
  cat: number;
  /** Slot position index (0-based). */
  slot: number;
  /** Transport unit ID. */
  tranId?: number;
  /** Modification list for the main unit. */
  modList: DeckModification[];
  /** Modification list for the transport. */
  modListTr?: DeckModification[];
  /** How many of this unit. */
  count?: number;
  /** How many transports (≤ count). */
  tranCount?: number;
}

/** A selected modification option within a deck slot. */
export interface DeckModification {
  modId: number;
  optId: number;
  cost: number;
  /** ReplaceUnitName from Option. */
  run?: string;
  /** ConcatenateWithUnitName from Option. */
  cwun?: string;
  type: number;
  /** ThumbnailOverride from Option (replaces unit label icon). */
  thumbnailOverride?: string;
  /** PortraitOverride from Option (replaces unit portrait). */
  portraitOverride?: string;
}

// ── Editor wrapper types ────────────────────────────────────────

/** A deck with editor metadata (max points/slots computed from specs). */
export interface EditorDeck {
  deckId: string;
  deck: Deck;
  deckMaxPoints: Record<Set2Key, number>;
  deckMaxSlots: Record<Set2Key, number>;
  createdAt: string;
  updatedAt: string;
  /** Country display name (stored at creation for offline display). */
  countryName?: string;
  /** Country flag file (stored at creation for offline display). */
  countryFlag?: string;
  /** Spec 1 game-locale key (UIName), e.g. "ui_spec_usmc_name". */
  spec1UIName?: string;
  /** Spec 2 game-locale key (UIName), e.g. "ui_spec_armored_name". */
  spec2UIName?: string;
  /** Spec 1 icon filename for toSpecializationIconPath(). */
  spec1Icon?: string;
  /** Spec 2 icon filename for toSpecializationIconPath(). */
  spec2Icon?: string;
  /** Cached total points (updated on every save from the editor). */
  cachedTotalPoints?: number;
  /** Cached per-category points (updated on every save from the editor). */
  cachedCategoryPoints?: Record<Set2Key, number>;
}

/** localStorage-backed deck store. */
export interface DeckStore {
  [key: string]: EditorDeck;
}

/** Aggregated stats for a deck (for the header display). */
export interface DeckStats {
  totalPoints: number;
  totalSlots: number;
  categoryStats: {
    [K in Set2Key]: {
      currentPoints: number;
      maxPoints: number;
      currentSlots: number;
      maxSlots: number;
      unitCount: number;
      totalAvailability: number;
      totalSeats: number;
      totalCargo: number;
    };
  };
}

/** Form data for the New Deck wizard. */
export interface NewDeckFormData {
  name: string;
  countryId: number;
  spec1Id: number;
  spec2Id: number;
}

// ── Compressed types (for deck code wire format) ────────────────

/** Compressed deck — metadata only, no option details. */
export interface CompressedDeck {
  country: number;
  spec1: number;
  spec2: number;
  set2: CompressedSet2;
}

export interface CompressedSet2 {
  Recon: CompressedUnitConfig[];
  Infantry: CompressedUnitConfig[];
  GroundCombatVehicles: CompressedUnitConfig[];
  Support: CompressedUnitConfig[];
  Logistic: CompressedUnitConfig[];
  Helicopters: CompressedUnitConfig[];
  Aircrafts: CompressedUnitConfig[];
}

export interface CompressedUnitConfig {
  unitId: number;
  count: number;
  modList: CompressedDeckModification[];
  tranId?: number;
  tranCount?: number;
  tranModList?: CompressedDeckModification[];
}

export interface CompressedDeckModification {
  modId: number;
  optId: number;
}
