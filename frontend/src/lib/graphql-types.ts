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
import type {
  PublishedDeck, PublishedDeckSummary, BrowseDecksResult,
  TrivialChallenge, ToggleLikeResult, RecordViewResult,
  DeckTag,
} from '@ba-hub/shared';
import type { RegisterUserResult, UserProfile } from '@ba-hub/shared';

/* ═══════════════════════════════════════════════════════════════════
 * Global Search — searchUnits query
 * ═══════════════════════════════════════════════════════════════════ */

/** A lightweight unit result from the searchUnits query. */
export type SearchUnitResult = Pick<
  Unit, 'Id' | 'HUDName' | 'ThumbnailFileName' | 'CountryId' | 'CategoryType' | 'Cost'
>;

/* ═══════════════════════════════════════════════════════════════════
 * Arsenal List Page — arsenalUnitsCards query
 * ═══════════════════════════════════════════════════════════════════ */

/** Unit fields returned inside an ArsenalCard. */
export type ArsenalUnit = Pick<
  Unit,
  'Id' | 'Name' | 'HUDName' | 'CountryId' | 'CategoryType' | 'Type' | 'Cost' |
  'ThumbnailFileName' | 'PortraitFileName' | 'IsUnitModification' | 'DisplayInArmory'
>;

/** A single card in the arsenal grid. */
export type ArsenalCard = {
  unit: ArsenalUnit;
  isTransport: boolean;
  specializationIds: number[];
  transportCapacity: number;
  cargoCapacity: number;
  availableTransports: number[];
  defaultModificationOptions: Array<{
    modId: number;
    optId: number;
    optCost: number;
    optRun: string | null;
    optCwun: string | null;
    type: number | null;
    optThumbnailOverride: string | null;
    optPortraitOverride: string | null;
  }>;
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
      'ReplaceUnitName' | 'ConcatenateWithUnitName' | 'OptionPicture' |
      'ThumbnailOverride' | 'PortraitOverride'
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
  transports: Array<Pick<Unit, 'Id' | 'Name' | 'HUDName' | 'ThumbnailFileName'>>;
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

/* ═══════════════════════════════════════════════════════════════════
 * Builder Page — builderData query
 * ═══════════════════════════════════════════════════════════════════ */

/** Country fields for the builder wizard. */
export type BuilderCountry = Pick<Country, 'Id' | 'Name' | 'FlagFileName' | 'MaxPoints' | 'Hidden'>;

/** Specialization with full slot/point budget fields. */
export type BuilderSpecialization = Pick<
  Specialization,
  'Id' | 'Name' | 'UIName' | 'UIDescription' | 'Icon' | 'Illustration' | 'CountryId' |
  'ReconSlots' | 'InfantrySlots' | 'CombatSlots' | 'SupportSlots' | 'LogisticsSlots' | 'HelicoptersSlots' | 'AirSlots' | 'MaxSlots' |
  'ReconPoints' | 'InfantryPoints' | 'CombatPoints' | 'SupportPoints' | 'LogisticsPoints' | 'HelicoptersPoints' | 'AirPoints'
>;

/** Availability entry keyed by spec + unit. */
export type BuilderAvailability = {
  specAvailabilityId: number;
  specializationId: number;
  unitId: number;
  maxAvailabilityXp0: number;
  maxAvailabilityXp1: number;
  maxAvailabilityXp2: number;
  maxAvailabilityXp3: number;
};

/** Full builderData query response. */
export type BuilderPageData = {
  countries: BuilderCountry[];
  specializations: BuilderSpecialization[];
  arsenalUnitsCards: ArsenalCard[];
  availabilities: BuilderAvailability[];
};

/** Option fields returned by optionsByIds query. */
export type BuilderOption = Pick<
  Option,
  'Id' | 'ModificationId' | 'Name' | 'UIName' | 'Cost' | 'IsDefault' | 'Order' |
  'ReplaceUnitName' | 'ConcatenateWithUnitName' | 'OptionPicture' |
  'ThumbnailOverride' | 'PortraitOverride'
>;

/* ═══════════════════════════════════════════════════════════════════
 * Unit Modifications — modifications(unitId) query
 * ═══════════════════════════════════════════════════════════════════ */

/** A modification slot as returned by the modifications(unitId) query. */
export type BuilderModSlot = {
  modification: Pick<
    Modification,
    'Id' | 'Name' | 'UIName' | 'Type' | 'Order' | 'ThumbnailFileName'
  >;
  options: BuilderOption[];
};

/** Response shape for the UNIT_MODIFICATIONS_QUERY. */
export type UnitModificationsResponse = Pick<
  Modification,
  'Id' | 'Name' | 'UIName' | 'Type' | 'Order' | 'ThumbnailFileName'
> & {
  options: Array<Pick<
    Option,
    'Id' | 'Name' | 'UIName' | 'Cost' | 'IsDefault' | 'Order' |
    'ReplaceUnitName' | 'ConcatenateWithUnitName' | 'OptionPicture' |
    'ThumbnailOverride' | 'PortraitOverride'
  >>;
};

/* ═══════════════════════════════════════════════════════════════════
 * Builder Unit Summary — lightweight unitDetail for floating panel
 * ═══════════════════════════════════════════════════════════════════ */

/** Lightweight weapon summary for the builder floating panel. */
export type BuilderWeaponSummary = {
  weapon: Pick<Weapon, 'Id' | 'HUDName' | 'Type' | 'HUDIcon' | 'CanShootOnTheMove'>;
  ammunition: Array<{
    quantity: number;
    ammunition: Pick<Ammunition,
      'HUDName' | 'HUDIcon' | 'HUDMultiplier' | 'Damage' | 'GroundRange' | 'MinimalRange' | 'TargetType' | 'ArmorTargeted' |
      'PenetrationAtMinRange' | 'PenetrationAtGroundRange' |
      'SupplyCost' | 'TopArmorAttack' | 'LaserGuided'
    >;
  }>;
};

/** Lightweight ability summary for the builder floating panel. */
export type BuilderAbilitySummary = {
  ECMAccuracyMultiplier: number;
  IsRadar: boolean;
  IsLaserDesignator: boolean;
  IsSmoke: boolean;
  IsAPS: boolean;
  IsDecoy: boolean;
};

/** Lightweight unit summary from BUILDER_UNIT_SUMMARY_QUERY. */
export type BuilderUnitSummary = {
  displayName: string;
  totalCost: number;
  unit: Pick<Unit, 'Id' | 'Name' | 'Type' | 'CategoryType' | 'Cost' | 'Weight' | 'Stealth' | 'InfantrySlots' | 'ThumbnailFileName' | 'PortraitFileName'>;
  armor: Pick<Armor, 'ArmorValue' | 'MaxHealthPoints' | 'KinArmorFront' | 'HeatArmorFront' | 'KinArmorRear' | 'HeatArmorRear' | 'KinArmorSides' | 'HeatArmorSides' | 'KinArmorTop' | 'HeatArmorTop'> | null;
  mobility: Pick<Mobility, 'MaxSpeedRoad' | 'MaxCrossCountrySpeed' | 'MaxSpeedReverse' | 'IsAmphibious' | 'IsAirDroppable' | 'Agility' | 'TurnRate' | 'LoiteringTime' | 'IsAfterburner'> | null;
  sensors: Array<{ OpticsGround: number; OpticsLowAltitude: number; OpticsHighAltitude: number }>;
  weapons: BuilderWeaponSummary[];
  abilities: BuilderAbilitySummary[];
  squadMembers: Array<{
    Id: number;
    primaryWeapon: Pick<Weapon, 'Id' | 'HUDName' | 'Type' | 'HUDIcon'> | null;
    specialWeapon: Pick<Weapon, 'Id' | 'HUDName' | 'Type' | 'HUDIcon'> | null;
  }>;
};

/* ═══════════════════════════════════════════════════════════════════
 * Published Decks — browse, detail, publish
 * ═══════════════════════════════════════════════════════════════════ */

/** Re-export shared types used directly in queries. */
export type {
  PublishedDeck, PublishedDeckSummary, BrowseDecksResult,
  TrivialChallenge, ToggleLikeResult, RecordViewResult,
  DeckTag,
  RegisterUserResult, UserProfile,
};

/** Like status query response. */
export type LikeStatus = {
  liked: boolean;
};
