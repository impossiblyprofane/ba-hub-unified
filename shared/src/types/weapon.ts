/** A weapon that can be mounted on or carried by a unit. */
export interface Weapon {
  Id: number;
  Name: string;
  HUDName: string;
  Type: number;
  HUDIcon: string;
  AudioPreset: string;
  ModelFileName: string;
  // Tracking
  WeaponChannel: number;
  WeaponPriority: number;
  MultiTargetTracking: number;
  SimultaneousTracking: number;
  // Flags
  AutoLoaded: boolean;
  IsVerticalLauncher: boolean;
  IsUnderbarrel: boolean;
  HasPriorityOnChassis: boolean;
  CanBeMerged: boolean;
  CanShootOnTheMove: boolean;
  StabilizerQuality: number;
  FlashPerShot: number;
  // Rotation
  LowerVerticalAngle: number;
  UpperVerticalAngles: number;
  VerticalRotationSpeed: number;
  // Magazine & timing
  MagazineSize: number;
  MagazineReloadTimeMin: number;
  MagazineReloadTimeMax: number;
  AimTimeMin: number;
  AimTimeMax: number;
  ShotsPerBurstMin: number;
  ShotsPerBurstMax: number;
  ShortGroundAttackBurst: number;
  NormalGroundAttackBurst: number;
  LongGroundAttackBurst: number;
  TimeBetweenBurstsMin: number;
  TimeBetweenBurstsMax: number;
  TimeBetweenShotsInBurst: number;
}
