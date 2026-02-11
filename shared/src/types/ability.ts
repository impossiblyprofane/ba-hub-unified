/** An ability that can be assigned to a unit (radar, smoke, APS, etc.). */
export interface Ability {
  Id: number;
  Name: string;
  IsDefault: boolean;
  ModelFileName: string;
  ECMAccuracyMultiplier: number;
  // Radar
  IsRadar: boolean;
  RadarLowAltOpticsModifier: number;
  RadarHighAltOpticsModifier: number;
  RadarLowAltWeaponRangeModifier: number;
  RadarHighAltWeaponRangeModifier: number;
  RadarSwitchCooldown: number;
  IsRadarStatic: boolean;
  // Laser Designator
  IsLaserDesignator: boolean;
  LaserMaxRange: number;
  LaserUsableInMove: boolean;
  // Infantry Sprint
  IsInfantrySprint: boolean;
  SprintDuration: number;
  SprintCooldown: number;
  // Smoke
  IsSmoke: boolean;
  SmokeAmmunitionId: string;
  SmokeAmmunitionQuantity: number;
  SmokeCooldown: number;
  // Active Protection System
  IsAPS: boolean;
  APSHitboxProportion: number;
  APSQuantity: number;
  APSCooldown: number;
  APSSupplyCost: number;
  APSResupplyTime: number;
  // Decoy
  IsDecoy: boolean;
  DecoyFXPreset: string;
  DecoyQuantity: number;
  DecoyAccuracyMultiplier: number;
  DecoyDuration: number;
  DecoyCooldown: number;
  DecoySupplyCost: number;
  DecoyResupplyTime: number;
}

/** Junction table — links a Unit to an Ability. */
export interface UnitAbility {
  Id: number;
  UnitId: number;
  AbilityId: number;
}
