/**
 * A saved deck — DB-backed, out of scope for now.
 * Keeping the shape here for forward reference.
 */
export interface Deck {
  id: string;
  name: string;
  countryId: number;
  specializationId: number;
  /** Ordered list of unit slot entries. */
  slots: DeckSlot[];
  createdAt: string;
  updatedAt: string;
}

/** One slot in a deck — a unit with its chosen options. */
export interface DeckSlot {
  /** Reference to Unit.Id. */
  unitId: number;
  /** Selected Option IDs for each modification slot. */
  selectedOptionIds: number[];
  /** Veterancy level (0–3). */
  veterancy: number;
  /** Transport unit ID, if applicable. */
  transportUnitId?: number;
}
