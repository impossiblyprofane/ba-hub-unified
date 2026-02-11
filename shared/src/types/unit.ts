/** A unit in the game — the core arsenal entry. */
export interface Unit {
  Id: number;
  Name: string;
  OriginalName: string;
  HUDName: string;
  Description: string;
  CountryId: number;
  OwnerInfantryID: number;
  DisplayInArmory: boolean;
  IsUnitModification: boolean;
  // Visuals
  ModelFileName: string;
  PortraitFileName: string;
  ThumbnailFileName: string;
  AudioPreset: string;
  // Classification
  Type: number;
  CategoryType: number;
  Role: number;
  // Cost
  Cost: number;
  OriginalCost: number;
  // Physical
  Length: number;
  Width: number;
  Height: number;
  Weight: number;
  Stealth: number;
  InfantrySlots: number;
  MaxStress: number;
  WaterDiveOffset: number;
  InBuildLevel: number;
}
