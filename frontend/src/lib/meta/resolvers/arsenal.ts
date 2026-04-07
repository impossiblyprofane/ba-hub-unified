import type { PageMeta } from '../types';
import { fetchGraphQL } from '../utils/graphql';
import { buildUnitSchema } from '../structured-data';

const UNIT_EMBED_QUERY = `
  query UnitEmbed($id: Int!, $optionIds: [Int!]) {
    unitDetail(id: $id, optionIds: $optionIds) {
      displayName
      totalCost
      unit { Id CategoryType Type PortraitFileName ThumbnailFileName }
      armor { ArmorValue MaxHealthPoints KinArmorFront HeatArmorFront KinArmorRear HeatArmorRear }
      mobility { MaxSpeedRoad MaxCrossCountrySpeed }
      weapons { weapon { HUDName Name } ammunition { ammunition { GroundRange } } }
    }
  }
`;

interface EmbedUnit {
  displayName: string;
  totalCost: number;
  unit: { Id: number; CategoryType: number; Type: number; PortraitFileName: string; ThumbnailFileName: string };
  armor: { ArmorValue: number; MaxHealthPoints: number; KinArmorFront: number; HeatArmorFront: number; KinArmorRear: number; HeatArmorRear: number } | null;
  mobility: { MaxSpeedRoad: number; MaxCrossCountrySpeed: number } | null;
  weapons: Array<{ weapon: { HUDName: string; Name: string }; ammunition: Array<{ ammunition: { GroundRange: number } }> }>;
}

function buildUnitIconUrl(unitData: EmbedUnit): string | null {
  const raw = unitData.unit.ThumbnailFileName;
  if (!raw) return null;
  // ThumbnailFileName uses mixed separators — normalize to forward slash, uppercase the filename
  const normalized = raw.replace(/\\/g, '/').toUpperCase();
  return `/images/labels/icons/${normalized}.png`.split(' ').join('%20');
}

function buildUnitDescription(unit: EmbedUnit): string {
  const parts: string[] = [`Cost: ${unit.totalCost}`];
  if (unit.armor) {
    parts.push(`HP: ${unit.armor.MaxHealthPoints}`);
    if (unit.armor.KinArmorFront > 0 || unit.armor.HeatArmorFront > 0) {
      parts.push(`Frontal KE: ${unit.armor.KinArmorFront}`, `Frontal HEAT: ${unit.armor.HeatArmorFront}`);
    } else {
      parts.push(`Armor: ${unit.armor.ArmorValue}`);
    }
  }
  if (unit.mobility) {
    const speed = Math.max(unit.mobility.MaxSpeedRoad || 0, unit.mobility.MaxCrossCountrySpeed || 0);
    if (speed > 0) parts.push(`Speed: ${speed} km/h`);
  }
  const names: string[] = [];
  for (const w of unit.weapons) {
    if (w.weapon.HUDName && !names.includes(w.weapon.HUDName)) names.push(w.weapon.HUDName);
    if (names.length >= 4) break;
  }
  if (names.length) parts.push(`Weapons: ${names.join(', ')}`);
  return parts.join(' · ');
}

export async function resolveArsenalMeta(
  unitId: number,
  optionIds: number[],
  siteUrl: string,
  pageUrl: string,
): Promise<PageMeta> {
  const data = await fetchGraphQL<{ unitDetail: EmbedUnit }>(UNIT_EMBED_QUERY, { id: unitId, optionIds: optionIds.length ? optionIds : null });
  const unit = data?.unitDetail;
  if (unit) {
    const description = buildUnitDescription(unit);
    const ogImage = buildUnitIconUrl(unit);
    return {
      title: `BA HUB - ${unit.displayName}`,
      description,
      ogImage,
      twitterCard: 'summary',
      structuredData: buildUnitSchema({
        unitId,
        name: unit.displayName,
        description,
        pageUrl,
        imageUrl: ogImage,
        siteUrl,
      }),
    };
  }
  return { title: `BA HUB - Unit ${unitId}`, description: `Detailed stats for unit ${unitId} in Broken Arrow.` };
}
