// Unit Type constants - Ported from original BA Hub project

export const UnitType = {
  None: 0,
  Infantry: 2,
  Vehicle: 4,
  Helicopter: 8,
  Aircraft: 16,
  Ship: 32,
  Projectile: 128
} as const;

export function toUnitTypeString(type: number): string {
  switch(type) {
    case UnitType.Infantry: return "Infantry";
    case UnitType.Vehicle: return "Vehicle";
    case UnitType.Helicopter: return "Helicopter";
    case UnitType.Aircraft: return "Aircraft";
    case UnitType.Ship: return "Ship";
    case UnitType.Projectile: return "Projectile";
    default: return "None";
  }
}

export type UnitTypeValue = typeof UnitType[keyof typeof UnitType]; 