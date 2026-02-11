/** Flight model preset for aircraft and helicopters. */
export interface FlyPreset {
  Id: number;
  Name: string;
  LowAltitudeIsDefault: boolean;
  OverrideAltitude: boolean;
  OverrideAltitideRatio: number;
  // Speed
  MinSpeed: number;
  CornerSpeed: number;
  MaxSpeed: number;
  AfterburnSpeed: number;
  AfterburnCornerSpeed: number;
  // Acceleration
  Acceleration: number;
  AfterburnerAcceleration: number;
  Deceleration: number;
  AfterburnerDeceleration: number;
  // Yaw / Pitch / Roll
  MinSpeedYaw: number;
  MaxSpeedYaw: number;
  AfterburnYaw: number;
  CornerSpeedYaw: number;
  MinSpeedPitch: number;
  MaxSpeedPitch: number;
  AfterburnPitch: number;
  MaxRoll: number;
  // Noise & shaking
  NoiseSpeed: number;
  NoiseSize: number;
  LocalShakingDepth: number;
  LocalShakingSpeed: number;
  // Nose lift
  NoseLiftStartSpeed: number;
  NoseLiftAngle: number;
  ForceCounterClockwise: boolean;
  // Strafing
  TargetAheadFactor: number;
  StrafeDiveAngle: number;
  StrafeSpeedRatio: number;
}

/** Ground / air mobility profile for a unit. */
export interface Mobility {
  Id: number;
  Name: string;
  ModelFileName: string;
  IsDefault: boolean;
  IsAmphibious: boolean;
  IsAirDroppable: boolean;
  Weight: number;
  HeavyLiftWeight: number;
  TurnRate: number;
  Acceleration: number;
  // Ground speed
  MaxCrossCountrySpeed: number;
  MaxSpeedRoad: number;
  MaxSpeedReverse: number;
  MaxSpeedWater: number;
  Agility: number;
  // Air
  ClimbRate: number;
  IsChangeAltitude: boolean;
  LoiteringTime: number;
  IsAfterburner: boolean;
  AfterBurningLoiteringTime: number;
  FlyPresetId: number;
  /** Resolved FlyPreset — may be populated by the loader or left as raw JSON. */
  FlyPreset?: FlyPreset | null;
}

/** Junction table — links a Unit to a Mobility (propulsion) profile. */
export interface UnitPropulsion {
  Id: number;
  UnitId: number;
  MobilityId: number;
}
