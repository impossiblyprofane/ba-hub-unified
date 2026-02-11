/** A modification slot on a unit (e.g. turret swap, armor upgrade). */
export interface Modification {
  Id: number;
  UnitId: number;
  Name: string;
  Type: number;
  UIName: string;
  ThumbnailFileName: string;
  Order: number;
}

/** A selectable option within a Modification slot. */
export interface Option {
  Id: number;
  ModificationId: number;
  Name: string;
  Order: number;
  UIName: string;
  OptionPicture: string;
  ConcatenateWithUnitName: string;
  ReplaceUnitName: string;
  ReplaceUnitId: number;
  Cost: number;
  ArmorId: number;
  MobilityId: number;
  MainSensorId: number;
  ExtraSensorId: number;
  Ability1Id: number;
  Ability2Id: number;
  Ability3Id: number;
  IsDefault: boolean;
  // Turret overrides (up to 21 slots)
  Turret0Id: number;
  Turret1Id: number;
  Turret2Id: number;
  Turret3Id: number;
  Turret4Id: number;
  Turret5Id: number;
  Turret6Id: number;
  Turret7Id: number;
  Turret8Id: number;
  Turret9Id: number;
  Turret10Id: number;
  Turret11Id: number;
  Turret12Id: number;
  Turret13Id: number;
  Turret14Id: number;
  Turret15Id: number;
  Turret16Id: number;
  Turret17Id: number;
  Turret18Id: number;
  Turret19Id: number;
  Turret20Id: number;
}
