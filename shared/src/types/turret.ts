/** A turret hardpoint that can mount weapons. */
export interface Turret {
  Id: number;
  Name: string;
  ModelFileName: string;
  IsDefault: boolean;
  ParentTurretId: number;
  FullRotation: boolean;
  LeftHorizontalAngle: number;
  RightHorizontalAngle: number;
  HorizontalRotationSpeed: number;
}

/** Junction table — links a default Turret to a Unit (with ordering). */
export interface TurretUnit {
  Id: number;
  UnitId: number;
  TurretId: number;
  Order: number;
}

/** Junction table — links a Weapon to a Turret (with ordering and priority). */
export interface TurretWeapon {
  Id: number;
  WeaponId: number;
  TurretId: number;
  Order: number;
  WeaponChannel: string;
  WeaponPriority: number;
}
