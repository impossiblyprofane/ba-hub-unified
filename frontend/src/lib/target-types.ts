// Target Type constants - Ported from original BA Hub frontend
import { UtilIconPaths } from "./iconPaths";

export const TargetType = {
  Ground: 1,
  Infantry: 2,
  Vehicle: 4,
  Helicopter: 8,
  Aircraft: 16,
  BallisticMissile: 32,
  Projectile: 128,
  Radar: 1028,
} as const;

export function TargetTypeToIcon(type: number): { icon: string; name: string } {
  switch (type) {
    case TargetType.Ground:
      return { icon: UtilIconPaths.PLACEHOLDER, name: "Ground" };
    case TargetType.Infantry:
      return { icon: UtilIconPaths.TARGET_TYPE_INF, name: "Infantry" };
    case TargetType.Vehicle:
      return { icon: UtilIconPaths.TARGET_TYPE_VEH, name: "Vehicle" };
    case TargetType.Helicopter:
      return { icon: UtilIconPaths.TARGET_TYPE_HELI, name: "Helicopter" };
    case TargetType.Aircraft:
      return { icon: UtilIconPaths.TARGET_TYPE_AIRCRAFT, name: "Aircraft" };
    // case TargetType.BallisticMissile: return { icon: UtilIconPaths.TARGET_TYPE_MISSILE, name: "Ballistic Missile" }; // Replace with Altered Version of Projectile
    case TargetType.Projectile:
      return { icon: UtilIconPaths.TARGET_TYPE_MISSILE, name: "Projectile" };
    case TargetType.Radar:
      return { icon: UtilIconPaths.TARGET_TYPE_RDR, name: "Radar" }; // This is bugged
    default:
      return { icon: "none", name: "Unknown" };
  }
}

export function decodeTargetTypes(type: number): { icon: string; name: string }[] {
  const result: { icon: string; name: string }[] = [];
  const values = (Object.values(TargetType) as number[])
    .sort((a, b) => b - a);

  for (const value of values) {
    if (type >= value) {
      result.unshift(TargetTypeToIcon(value));
      type -= value;
    }
  }

  return result;
} 