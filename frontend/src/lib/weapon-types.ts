// Weapon Type constants - Ported from original BA Hub frontend

export const WeaponType = {
  NotAssigned: 0,
  Rifle: 1,
  MarksmanRifle: 2,
  SniperRifle: 3,
  AntiMaterialRifle: 4,
  SuppressedCarbine: 5,
  BattleRifle: 6,
  SMG: 25,
  LightMachineGun: 26,
  MediumMachineGun: 27,
  HeavyMachineGun: 28,
  MiniGun: 29,
  SquadAutoWeapon: 30,
  Shotgun: 40,
  GrenadeLauncher: 60,
  AutoGrenadeLauncher: 61,
  RPGReloadable: 62,
  RPGDisposable: 63,
  Flashbang: 64,
  ATGM: 80,
  ATGMHE: 81,
  CruiseMissile: 82,
  BallisticMissile: 83,
  AntiRadarMissile: 84,
  SHORADMissile: 85,
  SAM: 86,
  A2AMissileRadar: 87,
  A2AMissileIR: 88,
  AGM: 89,
  MainGun: 110,
  Howitzer: 111,
  Mortar: 112,
  MLRS: 113,
  AutoCannon: 114,
  AntiAirGun: 115,
  PlaneGun: 116,
  RocketPod: 140,
  GunPod: 141,
  GrenadePod: 142,
  BombDumb: 160,
  BombDrag: 161,
  BombSmart: 162,
} as const;

export function weaponTypeToString(weaponType: number): string {
  switch (weaponType) {
    case WeaponType.NotAssigned: return 'unitViewer.weapons.types.weapon.notAssigned';
    case WeaponType.Rifle: return 'unitViewer.weapons.types.weapon.rifle';
    case WeaponType.MarksmanRifle: return 'unitViewer.weapons.types.weapon.marksmanRifle';
    case WeaponType.SniperRifle: return 'unitViewer.weapons.types.weapon.sniperRifle';
    case WeaponType.AntiMaterialRifle: return 'unitViewer.weapons.types.weapon.antiMaterialRifle';
    case WeaponType.SuppressedCarbine: return 'unitViewer.weapons.types.weapon.suppressedCarbine';
    case WeaponType.BattleRifle: return 'unitViewer.weapons.types.weapon.battleRifle';
    case WeaponType.SMG: return 'unitViewer.weapons.types.weapon.smg';
    case WeaponType.LightMachineGun: return 'unitViewer.weapons.types.weapon.lightMachineGun';
    case WeaponType.MediumMachineGun: return 'unitViewer.weapons.types.weapon.mediumMachineGun';
    case WeaponType.HeavyMachineGun: return 'unitViewer.weapons.types.weapon.heavyMachineGun';
    case WeaponType.MiniGun: return 'unitViewer.weapons.types.weapon.miniGun';
    case WeaponType.SquadAutoWeapon: return 'unitViewer.weapons.types.weapon.squadAutoWeapon';
    case WeaponType.Shotgun: return 'unitViewer.weapons.types.weapon.shotgun';
    case WeaponType.GrenadeLauncher: return 'unitViewer.weapons.types.weapon.grenadeLauncher';
    case WeaponType.AutoGrenadeLauncher: return 'unitViewer.weapons.types.weapon.autoGrenadeLauncher';
    case WeaponType.RPGReloadable: return 'unitViewer.weapons.types.weapon.rpgReloadable';
    case WeaponType.RPGDisposable: return 'unitViewer.weapons.types.weapon.rpgDisposable';
    case WeaponType.Flashbang: return 'unitViewer.weapons.types.weapon.flashbang';
    case WeaponType.ATGM: return 'unitViewer.weapons.types.weapon.atgm';
    case WeaponType.ATGMHE: return 'unitViewer.weapons.types.weapon.atgmHe';
    case WeaponType.CruiseMissile: return 'unitViewer.weapons.types.weapon.cruiseMissile';
    case WeaponType.BallisticMissile: return 'unitViewer.weapons.types.weapon.ballisticMissile';
    case WeaponType.AntiRadarMissile: return 'unitViewer.weapons.types.weapon.antiRadarMissile';
    case WeaponType.SHORADMissile: return 'unitViewer.weapons.types.weapon.shoradMissile';
    case WeaponType.SAM: return 'unitViewer.weapons.types.weapon.sam';
    case WeaponType.A2AMissileRadar: return 'unitViewer.weapons.types.weapon.a2aMissileRadar';
    case WeaponType.A2AMissileIR: return 'unitViewer.weapons.types.weapon.a2aMissileIr';
    case WeaponType.AGM: return 'unitViewer.weapons.types.weapon.agm';
    case WeaponType.MainGun: return 'unitViewer.weapons.types.weapon.mainGun';
    case WeaponType.Howitzer: return 'unitViewer.weapons.types.weapon.howitzer';
    case WeaponType.Mortar: return 'unitViewer.weapons.types.weapon.mortar';
    case WeaponType.MLRS: return 'unitViewer.weapons.types.weapon.mlrs';
    case WeaponType.AutoCannon: return 'unitViewer.weapons.types.weapon.autoCannon';
    case WeaponType.AntiAirGun: return 'unitViewer.weapons.types.weapon.antiAirGun';
    case WeaponType.PlaneGun: return 'unitViewer.weapons.types.weapon.planeGun';
    case WeaponType.RocketPod: return 'unitViewer.weapons.types.weapon.rocketPod';
    case WeaponType.GunPod: return 'unitViewer.weapons.types.weapon.gunPod';
    case WeaponType.GrenadePod: return 'unitViewer.weapons.types.weapon.grenadePod';
    case WeaponType.BombDumb: return 'unitViewer.weapons.types.weapon.bombDumb';
    case WeaponType.BombDrag: return 'unitViewer.weapons.types.weapon.bombDrag';
    case WeaponType.BombSmart: return 'unitViewer.weapons.types.weapon.bombSmart';
    default: return 'unitViewer.weapons.types.weapon.notAssigned';
  }
}

export type WeaponTypeValue = typeof WeaponType[keyof typeof WeaponType];