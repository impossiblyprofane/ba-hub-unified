/** A deck specialization (e.g. Mechanized, Armored, Support). */
export interface Specialization {
  Id: number;
  Name: string;
  UIName: string;
  ShowInHangar: boolean;
  UIDescription: string;
  Icon: string;
  Illustration: string;
  CountryId: number;
  // Slot limits per category
  ReconSlots: number;
  InfantrySlots: number;
  CombatSlots: number;
  SupportSlots: number;
  LogisticsSlots: number;
  HelicoptersSlots: number;
  AirSlots: number;
  MaxSlots: number;
  // Point budgets per category
  ReconPoints: number;
  InfantryPoints: number;
  CombatPoints: number;
  SupportPoints: number;
  LogisticsPoints: number;
  HelicoptersPoints: number;
  AirPoints: number;
}

/** Unit availability within a specialization (per veterancy level). */
export interface SpecializationAvailability {
  Id: number;
  SpecializationId: number;
  UnitId: number;
  MaxAvailabilityXp0: number;
  MaxAvailabilityXp1: number;
  MaxAvailabilityXp2: number;
  MaxAvailabilityXp3: number;
}
