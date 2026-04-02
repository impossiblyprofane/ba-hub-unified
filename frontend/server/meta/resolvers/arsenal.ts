import type { PageMeta } from '../types.js';
import { fetchGraphQL } from '../utils/graphql.js';

const UNIT_EMBED_QUERY = `
  query UnitEmbed($id: Int!, $optionIds: [Int!]) {
    unitDetail(id: $id, optionIds: $optionIds) {
      displayName
      totalCost
      unit { Id CategoryType Type PortraitFileName ThumbnailFileName }
      armor {
        ArmorValue MaxHealthPoints
        KinArmorFront HeatArmorFront KinArmorRear HeatArmorRear
      }
      mobility { MaxSpeedRoad MaxCrossCountrySpeed }
      weapons {
        weapon { HUDName Name }
        ammunition { ammunition { GroundRange } }
      }
    }
  }
`;

interface EmbedUnit {
  displayName: string;
  totalCost: number;
  unit: { Id: number; CategoryType: number; Type: number; PortraitFileName: string; ThumbnailFileName: string };
  armor: {
    ArmorValue: number; MaxHealthPoints: number;
    KinArmorFront: number; HeatArmorFront: number;
    KinArmorRear: number; HeatArmorRear: number;
  } | null;
  mobility: { MaxSpeedRoad: number; MaxCrossCountrySpeed: number } | null;
  weapons: Array<{
    weapon: { HUDName: string; Name: string };
    ammunition: Array<{ ammunition: { GroundRange: number } }>;
  }>;
}

function buildPortraitUrl(unitData: EmbedUnit): string | null {
  const raw = unitData.unit.PortraitFileName || unitData.unit.ThumbnailFileName;
  if (!raw) return null;
  const split = raw.split('\\');
  const prefix = split.slice(0, -1).join('/').toLowerCase();
  const fileName = split[split.length - 1].toUpperCase();
  const encoded = `/images/unitportraits/${prefix}/${fileName}_HOVER.png`.split(' ').join('%20');
  return encoded;
}

function buildUnitDescription(unit: EmbedUnit): string {
  const parts: string[] = [];
  parts.push(`Cost: ${unit.totalCost}`);

  if (unit.armor) {
    parts.push(`HP: ${unit.armor.MaxHealthPoints}`);
    const hasDirArmor = unit.armor.KinArmorFront > 0 || unit.armor.HeatArmorFront > 0 ||
      unit.armor.KinArmorRear > 0 || unit.armor.HeatArmorRear > 0;
    if (hasDirArmor) {
      parts.push(`Frontal KE: ${unit.armor.KinArmorFront}`);
      parts.push(`Frontal HEAT: ${unit.armor.HeatArmorFront}`);
    } else {
      parts.push(`Armor: ${unit.armor.ArmorValue}`);
    }
  }

  if (unit.mobility) {
    const speed = Math.max(unit.mobility.MaxSpeedRoad || 0, unit.mobility.MaxCrossCountrySpeed || 0);
    if (speed > 0) parts.push(`Speed: ${speed} km/h`);
  }

  const weaponNames: string[] = [];
  for (const w of unit.weapons) {
    const name = w.weapon.HUDName;
    if (name && !weaponNames.includes(name)) weaponNames.push(name);
    if (weaponNames.length >= 4) break;
  }
  if (weaponNames.length) parts.push(`Weapons: ${weaponNames.join(', ')}`);

  return parts.join(' · ');
}

export async function resolveArsenalMeta(
  unitId: number,
  optionIds: number[],
): Promise<PageMeta> {
  const data = await fetchGraphQL<{ unitDetail: EmbedUnit }>(
    UNIT_EMBED_QUERY,
    { id: unitId, optionIds: optionIds.length ? optionIds : null },
  );
  const unit = data?.unitDetail;

  if (unit) {
    return {
      title: `${unit.displayName} — BA Hub Arsenal`,
      description: buildUnitDescription(unit),
      ogImage: buildPortraitUrl(unit),
    };
  }

  return {
    title: `Unit ${unitId} - BA Hub Arsenal`,
    description: `Detailed stats, weapons, modifications, and availability for unit ${unitId} in Broken Arrow.`,
  };
}
