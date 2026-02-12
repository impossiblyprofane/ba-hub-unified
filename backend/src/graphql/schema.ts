// GraphQL schema definition
export const schema = `
  type Query {
    units(filter: UnitFilter, offset: Int = 0, limit: Int = 50): [Unit!]!
    unit(id: Int!): Unit
    arsenalUnitsCards: [ArsenalUnitCard!]!
    arsenalUnitCard(unitId: Int!): ArsenalUnitCard
    countries: [Country!]!
    weapons(search: String, offset: Int = 0, limit: Int = 50): [Weapon!]!
    weapon(id: Int!): Weapon
    ammunitions(search: String, offset: Int = 0, limit: Int = 50): [Ammunition!]!
    ammunition(id: Int!): Ammunition
    turrets: [Turret!]!
    turret(id: Int!): Turret
    abilities: [Ability!]!
    armors: [Armor!]!
    mobility: [Mobility!]!
    sensors: [Sensor!]!
    modifications(unitId: Int): [Modification!]!
    options(modificationId: Int): [Option!]!
    specializations: [Specialization!]!
    specialization(id: Int!): Specialization
    arsenalFilters: ArsenalFilters!
  }

  type Mutation {
    ping: String!
  }

  type Subscription {
    messageAdded: String!
  }

  input UnitFilter {
    search: String
    countryId: Int
    type: Int
    categoryType: Int
    role: Int
    displayInArmory: Boolean
    isUnitModification: Boolean
  }

  type ArsenalFilters {
    countries: [Country!]!
    types: [Int!]!
    categoryTypes: [Int!]!
    roles: [Int!]!
  }

  type ArsenalDefaultModificationOption {
    modId: Int!
    optId: Int!
    optCost: Int!
    optRun: String
    optCwun: String
    type: Int
  }

  type ArsenalUnitCard {
    unit: Unit!
    isTransport: Boolean!
    specializationIds: [Int!]!
    transportCapacity: Int!
    cargoCapacity: Float!
    availableTransports: [Int!]!
    defaultModificationOptions: [ArsenalDefaultModificationOption!]!
  }

  type Unit {
    Id: Int!
    Name: String
    OriginalName: String
    HUDName: String
    Description: String
    CountryId: Int
    OwnerInfantryID: Int
    DisplayInArmory: Boolean
    IsUnitModification: Boolean
    ModelFileName: String
    PortraitFileName: String
    ThumbnailFileName: String
    AudioPreset: String
    Type: Int
    CategoryType: Int
    Role: Int
    Cost: Int
    OriginalCost: Int
    Length: Float
    Width: Float
    Height: Float
    Weight: Float
    Stealth: Int
    InfantrySlots: Int
    MaxStress: Int
    WaterDiveOffset: Int
    InBuildLevel: Int
    country: Country
    abilities: [Ability!]!
    armors: [Armor!]!
    mobility: [Mobility!]!
    sensors: [Sensor!]!
    turrets: [Turret!]!
    weapons: [UnitWeapon!]!
    modifications: [Modification!]!
    squadMembers: [SquadMember!]!
    squadWeapons: [Weapon!]!
  }

  type UnitWeapon {
    weapon: Weapon!
    turret: Turret
    ammunition: [WeaponAmmunitionSlot!]!
  }

  type WeaponAmmunitionSlot {
    ammunition: Ammunition!
    order: Int!
    quantity: Int!
  }

  type Ability {
    Id: Int!
    Name: String
    IsDefault: Boolean
    ModelFileName: String
    ECMAccuracyMultiplier: Float
    IsRadar: Boolean
    RadarLowAltOpticsModifier: Float
    RadarHighAltOpticsModifier: Float
    RadarLowAltWeaponRangeModifier: Float
    RadarHighAltWeaponRangeModifier: Float
    RadarSwitchCooldown: Float
    IsRadarStatic: Boolean
    IsLaserDesignator: Boolean
    LaserMaxRange: Float
    LaserUsableInMove: Boolean
    IsInfantrySprint: Boolean
    SprintDuration: Float
    SprintCooldown: Float
    IsSmoke: Boolean
    SmokeAmmunitionId: String
    SmokeAmmunitionQuantity: Int
    SmokeCooldown: Float
    IsAPS: Boolean
    APSHitboxProportion: Float
    APSQuantity: Int
    APSCooldown: Float
    APSSupplyCost: Int
    APSResupplyTime: Float
    IsDecoy: Boolean
    DecoyFXPreset: String
    DecoyQuantity: Int
    DecoyAccuracyMultiplier: Float
    DecoyDuration: Float
    DecoyCooldown: Float
    DecoySupplyCost: Int
    DecoyResupplyTime: Float
  }

  type Ammunition {
    Id: Int!
    Name: String
    HUDName: String
    HUDIcon: String
    AudioPreset: String
    UiOptions: Int
    FxPreset: String
    VfxCountPerShot: Int
    VfxCountPerShotMax: Int
    ModelFileName: String
    HUDMultiplier: Float
    CriticMultiplier: Float
    SupplyCost: Int
    ResupplyTime: Float
    Damage: Float
    StressDamage: Float
    IgnoreCover: Int
    TargetType: Int
    ArmorTargeted: Int
    TrajectoryType: Int
    MinimalRange: Float
    GroundRange: Float
    LowAltRange: Float
    HighAltRange: Float
    OverflyHeight: Float
    PenetrationAtMinRange: Float
    PenetrationAtGroundRange: Float
    NoDamageFalloff: Boolean
    TopArmorAttack: Boolean
    HealthAOERadius: Float
    StressAOERadius: Float
    RadioFuseDistance: Float
    LaunchMarginAngle: Float
    MuzzleVelocity: Float
    MaxSpeed: Float
    Acceleration: Float
    DispersionHorizontalRadius: Float
    DispersionVerticalRadius: Float
    GenerateSmoke: Boolean
    SmokeRadius: Float
    SmokeDuration: Float
    SmokeFadeDuration: Float
    DamageOverTimeDuration: Float
    LaserGuided: Boolean
    Seeker: Int
    SeekerAngle: Float
    MaxSeekerDistance: Float
    CanBeIntercepted: Boolean
    CanBeTargeted: Boolean
    CanReaquire: Boolean
    AimStartDelay: Float
    MainEngineIgnitionDelay: Float
    RotationSpeed: Float
    BurnTime: Float
    PreEgnitionRotationSpeed: Float
    PreventReloadWhileTracked: Boolean
    Airburst: Boolean
    LoftAngle: Float
    LoftHeight: Float
  }

  type Armor {
    Id: Int!
    Name: String
    ModelFileName: String
    IsDefault: Boolean
    ArmorValue: Float
    MaxHealthPoints: Float
    HeatArmorFront: Float
    HeatArmorRear: Float
    HeatArmorSides: Float
    HeatArmorTop: Float
    KinArmorFront: Float
    KinArmorRear: Float
    KinArmorSides: Float
    KinArmorTop: Float
  }

  type Country {
    Id: Int!
    Name: String
    FlagFileName: String
    MaxPoints: Int
    SpecializationsNumber: Int
    Hidden: Boolean
  }

  type FlyPreset {
    Id: Int!
    Name: String
    LowAltitudeIsDefault: Boolean
    OverrideAltitude: Boolean
    OverrideAltitideRatio: Float
    MinSpeed: Float
    CornerSpeed: Float
    MaxSpeed: Float
    AfterburnSpeed: Float
    AfterburnCornerSpeed: Float
    Acceleration: Float
    AfterburnerAcceleration: Float
    Deceleration: Float
    AfterburnerDeceleration: Float
    MinSpeedYaw: Float
    MaxSpeedYaw: Float
    AfterburnYaw: Float
    CornerSpeedYaw: Float
    MinSpeedPitch: Float
    MaxSpeedPitch: Float
    AfterburnPitch: Float
    MaxRoll: Float
    NoiseSpeed: Float
    NoiseSize: Float
    LocalShakingDepth: Float
    LocalShakingSpeed: Float
    NoseLiftStartSpeed: Float
    NoseLiftAngle: Float
    ForceCounterClockwise: Boolean
    TargetAheadFactor: Float
    StrafeDiveAngle: Float
    StrafeSpeedRatio: Float
  }

  type Mobility {
    Id: Int!
    Name: String
    ModelFileName: String
    IsDefault: Boolean
    IsAmphibious: Boolean
    IsAirDroppable: Boolean
    Weight: Float
    HeavyLiftWeight: Float
    TurnRate: Float
    Acceleration: Float
    MaxCrossCountrySpeed: Float
    MaxSpeedRoad: Float
    MaxSpeedReverse: Float
    MaxSpeedWater: Float
    Agility: Float
    ClimbRate: Float
    IsChangeAltitude: Boolean
    LoiteringTime: Float
    IsAfterburner: Boolean
    AfterBurningLoiteringTime: Float
    FlyPresetId: Int
    flyPreset: FlyPreset
  }

  type Modification {
    Id: Int!
    UnitId: Int!
    Name: String
    Type: Int
    UIName: String
    ThumbnailFileName: String
    Order: Int
    unit: Unit
    options: [Option!]!
  }

  type Option {
    Id: Int!
    ModificationId: Int!
    Name: String
    Order: Int
    UIName: String
    OptionPicture: String
    ConcatenateWithUnitName: String
    ReplaceUnitName: String
    ReplaceUnitId: Int
    Cost: Int
    ArmorId: Int
    MobilityId: Int
    MainSensorId: Int
    ExtraSensorId: Int
    Ability1Id: Int
    Ability2Id: Int
    Ability3Id: Int
    IsDefault: Boolean
    Turret0Id: Int
    Turret1Id: Int
    Turret2Id: Int
    Turret3Id: Int
    Turret4Id: Int
    Turret5Id: Int
    Turret6Id: Int
    Turret7Id: Int
    Turret8Id: Int
    Turret9Id: Int
    Turret10Id: Int
    Turret11Id: Int
    Turret12Id: Int
    Turret13Id: Int
    Turret14Id: Int
    Turret15Id: Int
    Turret16Id: Int
    Turret17Id: Int
    Turret18Id: Int
    Turret19Id: Int
    Turret20Id: Int
    armor: Armor
    mobility: Mobility
    mainSensor: Sensor
    extraSensor: Sensor
    abilities: [Ability!]!
    turrets: [Turret!]!
    replaceUnit: Unit
  }

  type Sensor {
    Id: Int!
    Name: String
    IsDefault: Boolean
    OpticsGround: Float
    OpticsHighAltitude: Float
    OpticsLowAltitude: Float
    ModelFileName: String
  }

  type Specialization {
    Id: Int!
    Name: String
    UIName: String
    ShowInHangar: Boolean
    UIDescription: String
    Icon: String
    Illustration: String
    CountryId: Int
    ReconSlots: Int
    InfantrySlots: Int
    CombatSlots: Int
    SupportSlots: Int
    LogisticsSlots: Int
    HelicoptersSlots: Int
    AirSlots: Int
    MaxSlots: Int
    ReconPoints: Int
    InfantryPoints: Int
    CombatPoints: Int
    SupportPoints: Int
    LogisticsPoints: Int
    HelicoptersPoints: Int
    AirPoints: Int
    country: Country
    availabilities: [SpecializationAvailability!]!
  }

  type SpecializationAvailability {
    Id: Int!
    SpecializationId: Int!
    UnitId: Int!
    MaxAvailabilityXp0: Int
    MaxAvailabilityXp1: Int
    MaxAvailabilityXp2: Int
    MaxAvailabilityXp3: Int
    unit: Unit
    transports: [TransportAvailability!]!
  }

  type TransportAvailability {
    Id: Int!
    SpecializationAvailabilityId: Int!
    UnitId: Int!
    unit: Unit
    specializationAvailability: SpecializationAvailability
  }

  type SquadMember {
    Id: Int!
    UnitId: Int!
    DeathPriority: Int
    ModelFileName: String
    PrimaryWeaponId: Int
    SpecialWeaponId: Int
    primaryWeapon: Weapon
    specialWeapon: Weapon
  }

  type Turret {
    Id: Int!
    Name: String
    ModelFileName: String
    IsDefault: Boolean
    ParentTurretId: Int
    FullRotation: Boolean
    LeftHorizontalAngle: Float
    RightHorizontalAngle: Float
    HorizontalRotationSpeed: Float
    turretWeapons: [TurretWeapon!]!
  }

  type TurretWeapon {
    Id: Int!
    WeaponId: Int!
    TurretId: Int!
    Order: Int
    WeaponChannel: String
    WeaponPriority: Int
    weapon: Weapon
    turret: Turret
  }

  type Weapon {
    Id: Int!
    Name: String
    HUDName: String
    Type: Int
    HUDIcon: String
    AudioPreset: String
    ModelFileName: String
    WeaponChannel: Int
    WeaponPriority: Int
    MultiTargetTracking: Int
    SimultaneousTracking: Int
    AutoLoaded: Boolean
    IsVerticalLauncher: Boolean
    IsUnderbarrel: Boolean
    HasPriorityOnChassis: Boolean
    CanBeMerged: Boolean
    CanShootOnTheMove: Boolean
    StabilizerQuality: Int
    FlashPerShot: Int
    LowerVerticalAngle: Float
    UpperVerticalAngles: Float
    VerticalRotationSpeed: Float
    MagazineSize: Int
    MagazineReloadTimeMin: Float
    MagazineReloadTimeMax: Float
    AimTimeMin: Float
    AimTimeMax: Float
    ShotsPerBurstMin: Int
    ShotsPerBurstMax: Int
    ShortGroundAttackBurst: Int
    NormalGroundAttackBurst: Int
    LongGroundAttackBurst: Int
    TimeBetweenBurstsMin: Float
    TimeBetweenBurstsMax: Float
    TimeBetweenShotsInBurst: Float
  }
`;
