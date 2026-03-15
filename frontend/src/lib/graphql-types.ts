/**
 * GraphQL response types for the frontend.
 *
 * These represent the *selected fields* returned by each GraphQL query,
 * derived from the canonical @ba-hub/shared types via Pick where possible.
 * Composite / nested response shapes are defined as standalone types.
 */

import type {
  Unit, Country, Specialization, Armor, Mobility,
  Sensor, Ability, Weapon, Turret, Modification, Option,
  Ammunition,
} from '@ba-hub/shared';

/* ═══════════════════════════════════════════════════════════════════
 * Arsenal List Page — arsenalUnitsCards query
 * ═══════════════════════════════════════════════════════════════════ */

/** Unit fields returned inside an ArsenalCard. */
export type ArsenalUnit = Pick<
  Unit,
  'Id' | 'Name' | 'HUDName' | 'CountryId' | 'CategoryType' | 'Cost' |
  'ThumbnailFileName' | 'IsUnitModification' | 'DisplayInArmory'
>;

/** A single card in the arsenal grid. */
export type ArsenalCard = {
  unit: ArsenalUnit;
  isTransport: boolean;
  specializationIds: number[];
  transportCapacity: number;
  cargoCapacity: number;
  availableTransports: number[];
  defaultModificationOptions: Array<{ optCost: number }>;
};

/** Country fields used in the arsenal page. */
export type ArsenalCountry = Pick<Country, 'Id' | 'Name' | 'FlagFileName'>;

/** Specialization fields used in the arsenal page. */
export type ArsenalSpecialization = Pick<
  Specialization,
  'Id' | 'CountryId' | 'UIName' | 'UIDescription' | 'Icon'
>;

/** Full arsenal page data payload. */
export type ArsenalPageData = {
  arsenalUnitsCards: ArsenalCard[];
  countries: ArsenalCountry[];
  specializations: ArsenalSpecialization[];
};

/* ═══════════════════════════════════════════════════════════════════
 * Unit Detail Page — unitDetail query
 * ═══════════════════════════════════════════════════════════════════ */

/** Unit fields returned within the unitDetail result. */
export type UnitDetailUnit = Pick<
  Unit,
  'Id' | 'Name' | 'HUDName' | 'Description' | 'CountryId' |
  'Type' | 'CategoryType' | 'Role' | 'Cost' |
  'PortraitFileName' | 'ThumbnailFileName' |
  'Weight' | 'Stealth' | 'InfantrySlots' | 'MaxStress' |
  'Length' | 'Width' | 'Height' |
  'DisplayInArmory' | 'IsUnitModification'
>;

/** Armor fields returned within the unitDetail result. */
export type UnitDetailArmor = Pick<
  Armor,
  'Id' | 'Name' | 'ArmorValue' | 'MaxHealthPoints' |
  'HeatArmorFront' | 'HeatArmorRear' | 'HeatArmorSides' | 'HeatArmorTop' |
  'KinArmorFront' | 'KinArmorRear' | 'KinArmorSides' | 'KinArmorTop'
>;

/** Mobility fields returned within the unitDetail result. */
export type UnitDetailMobility = Pick<
  Mobility,
  'Id' | 'Name' | 'IsAmphibious' | 'IsAirDroppable' |
  'Weight' | 'HeavyLiftWeight' | 'TurnRate' | 'Acceleration' |
  'MaxCrossCountrySpeed' | 'MaxSpeedRoad' | 'MaxSpeedReverse' |
  'MaxSpeedWater' | 'Agility' | 'ClimbRate' |
  'IsChangeAltitude' | 'LoiteringTime' | 'IsAfterburner' |
  'AfterBurningLoiteringTime'
>;

/** FlyPreset fields returned within the unitDetail result. */
export type UnitDetailFlyPreset = {
  Id: number;
  MaxSpeed: number;
  AfterburnSpeed: number;
  CornerSpeed: number;
  MinSpeed: number;
  Acceleration: number;
  Deceleration: number;
};

/** Sensor fields returned within the unitDetail result. */
export type UnitDetailSensor = Pick<
  Sensor,
  'Id' | 'Name' | 'OpticsGround' | 'OpticsHighAltitude' | 'OpticsLowAltitude'
>;

/** Ability fields returned within the unitDetail result. */
export type UnitDetailAbility = Pick<
  Ability,
  'Id' | 'Name' | 'IsDefault' | 'ECMAccuracyMultiplier' |
  'IsRadar' | 'RadarLowAltOpticsModifier' | 'RadarHighAltOpticsModifier' |
  'RadarLowAltWeaponRangeModifier' | 'RadarHighAltWeaponRangeModifier' |
  'IsRadarStatic' | 'RadarSwitchCooldown' |
  'IsLaserDesignator' | 'LaserMaxRange' | 'LaserUsableInMove' |
  'IsInfantrySprint' | 'SprintDuration' | 'SprintCooldown' |
  'IsSmoke' | 'SmokeAmmunitionQuantity' | 'SmokeCooldown' |
  'IsAPS' | 'APSQuantity' | 'APSCooldown' | 'APSHitboxProportion' |
  'APSSupplyCost' | 'APSResupplyTime' |
  'IsDecoy' | 'DecoyQuantity' | 'DecoyAccuracyMultiplier' |
  'DecoyCooldown' | 'DecoyDuration' | 'DecoySupplyCost' | 'DecoyResupplyTime'
>;

/** Ammunition fields returned within the unitDetail result. */
export type UnitDetailAmmo = Pick<
  Ammunition,
  'Id' | 'Name' | 'HUDName' | 'HUDIcon' |
  'Damage' | 'StressDamage' | 'PenetrationAtMinRange' | 'PenetrationAtGroundRange' |
  'GroundRange' | 'LowAltRange' | 'HighAltRange' | 'MinimalRange' |
  'TargetType' | 'ArmorTargeted' | 'TrajectoryType' |
  'TopArmorAttack' | 'IsTopArmorArmorAttack' | 'LaserGuided' | 'CanBeIntercepted' |
  'NoDamageFalloff' | 'IgnoreCover' |
  'HealthAOERadius' | 'StressAOERadius' | 'OverpressureRadius' |
  'RadioFuseDistance' | 'DamageOverTimeDuration' |
  'MuzzleVelocity' | 'MaxSpeed' |
  'DispersionHorizontalRadius' | 'DispersionVerticalRadius' |
  'SupplyCost' | 'ResupplyTime' |
  'GenerateSmoke' | 'Seeker' | 'SeekerAngle' |
  'MaxSeekerDistance' | 'CanBeTargeted' | 'CanReaquire' |
  'AimStartDelay' | 'MainEngineIgnitionDelay' |
  'RotationSpeed' | 'BurnTime' | 'Airburst' |
  'HUDMultiplier' | 'CriticMultiplier'
>;

/** Weapon + turret + ammunition as nested in the unitDetail response. */
export type UnitDetailWeapon = {
  weapon: Pick<
    Weapon,
    'Id' | 'Name' | 'HUDName' | 'Type' | 'HUDIcon' |
    'AutoLoaded' | 'IsVerticalLauncher' | 'CanShootOnTheMove' |
    'MagazineSize' | 'MagazineReloadTimeMin' | 'MagazineReloadTimeMax' |
    'AimTimeMin' | 'AimTimeMax' |
    'ShotsPerBurstMin' | 'ShotsPerBurstMax' |
    'TimeBetweenShotsInBurst' | 'TimeBetweenBurstsMin' | 'TimeBetweenBurstsMax' |
    'MultiTargetTracking' | 'SimultaneousTracking' |
    'CanBeMerged' | 'StabilizerQuality'
  >;
  turret: Pick<
    Turret,
    'Id' | 'Name' | 'FullRotation' |
    'LeftHorizontalAngle' | 'RightHorizontalAngle' | 'HorizontalRotationSpeed'
  > | null;
  ammunition: Array<{
    order: number;
    quantity: number;
    ammunition: UnitDetailAmmo;
  }>;
};

/** A modification slot with its options, as nested in the unitDetail response. */
export type UnitDetailModSlot = {
  modification: Pick<
    Modification,
    'Id' | 'Name' | 'UIName' | 'Type' | 'Order' | 'ThumbnailFileName'
  >;
  options: Array<
    Pick<
      Option,
      'Id' | 'Name' | 'UIName' | 'Cost' | 'IsDefault' | 'Order' |
      'ReplaceUnitName' | 'ConcatenateWithUnitName' | 'OptionPicture'
    >
  >;
  selectedOptionId: number;
};

/** Squad member as returned in the unitDetail response. */
export type UnitDetailSquadMember = {
  Id: number;
  DeathPriority: number;
  ModelFileName: string;
  primaryWeapon: Pick<Weapon, 'Id' | 'Name' | 'HUDName' | 'Type' | 'HUDIcon'> | null;
  specialWeapon: Pick<Weapon, 'Id' | 'Name' | 'HUDName' | 'Type' | 'HUDIcon'> | null;
};

/** Availability entry as returned in the unitDetail response. */
export type UnitDetailAvailability = {
  specialization: Pick<Specialization, 'Id' | 'Name' | 'UIName' | 'Icon' | 'CountryId'>;
  maxAvailability: number;
  transports: Array<Pick<Unit, 'Id' | 'Name' | 'ThumbnailFileName'>>;
};

/** Complete unitDetail query response. */
export type UnitDetailData = {
  unit: UnitDetailUnit;
  baseUnit: Pick<Unit, 'Id' | 'Name' | 'Cost'>;
  displayName: string;
  totalCost: number;
  country: Pick<Country, 'Id' | 'Name' | 'FlagFileName'> | null;
  armor: UnitDetailArmor | null;
  mobility: UnitDetailMobility | null;
  flyPreset: UnitDetailFlyPreset | null;
  sensors: UnitDetailSensor[];
  abilities: UnitDetailAbility[];
  weapons: UnitDetailWeapon[];
  modifications: UnitDetailModSlot[];
  squadMembers: UnitDetailSquadMember[];
  availability: UnitDetailAvailability[];
};
