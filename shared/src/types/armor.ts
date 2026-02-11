/** An armor profile with directional KE and HEAT values. */
export interface Armor {
  Id: number;
  Name: string;
  ModelFileName: string;
  IsDefault: boolean;
  ArmorValue: number;
  MaxHealthPoints: number;
  // HEAT armor per facing
  HeatArmorFront: number;
  HeatArmorRear: number;
  HeatArmorSides: number;
  HeatArmorTop: number;
  // Kinetic armor per facing
  KinArmorFront: number;
  KinArmorRear: number;
  KinArmorSides: number;
  KinArmorTop: number;
}

/** Junction table — links a Unit to an Armor profile. */
export interface UnitArmor {
  Id: number;
  UnitId: number;
  ArmorId: number;
}
