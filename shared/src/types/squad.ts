/** An individual member of an infantry squad. */
export interface SquadMember {
  Id: number;
  UnitId: number;
  DeathPriority: number;
  ModelFileName: string;
  PrimaryWeaponId: number;
  SpecialWeaponId: number;
}

/** Junction table — links a squad Unit to a Weapon it can carry. */
export interface SquadWeapon {
  Id: number;
  WeaponId: number;
  UnitId: number;
}
