/**
 * Compare-mode utility functions.
 *
 * Extracts comparable metrics from UnitDetailData and determines
 * which unit has the advantage for each metric.
 */

import type { UnitDetailData } from './graphql-types';

/* ── Metric definition ───────────────────────────────────────────── */

export type CompareDirection = 'lower' | 'higher';

export interface CompareMetricDef {
  /** i18n key for the metric label */
  i18nKey: string;
  /** Extract a numeric value from unit data. null = not applicable */
  extract: (data: UnitDetailData) => number | null;
  /** Whether a lower or higher value is "better" */
  betterWhen: CompareDirection;
}

export interface CompareResult {
  i18nKey: string;
  valueA: number | null;
  valueB: number | null;
  /** 'a' = unit A wins, 'b' = unit B wins, 'equal' = same, null = not comparable */
  winner: 'a' | 'b' | 'equal' | null;
  /** Formatted display values */
  displayA: string;
  displayB: string;
}

/* ── Metric extractors ───────────────────────────────────────────── */

/** Stealth is stored as a multiplier (lower = more stealthy). Display as 1/stealth. */
function extractStealth(data: UnitDetailData): number | null {
  const s = data.unit.Stealth;
  if (s === undefined || s === null || s <= 0) return null;
  return parseFloat((1 / Math.max(0.1, s)).toFixed(2));
}

/** Determine if unit has directional armor */
function hasDirArmor(data: UnitDetailData): boolean {
  if (!data.armor) return false;
  return (
    data.armor.KinArmorFront > 0 || data.armor.HeatArmorFront > 0 ||
    data.armor.KinArmorRear > 0 || data.armor.HeatArmorRear > 0
  );
}

function extractArmorGeneral(data: UnitDetailData): number | null {
  if (!data.armor) return null;
  if (hasDirArmor(data)) return null; // vehicles use frontal instead
  return data.armor.ArmorValue;
}

function extractArmorFront(data: UnitDetailData): number | null {
  if (!data.armor) return null;
  if (!hasDirArmor(data)) return null; // non-vehicles use general
  // Show sum of heat+kin frontal as a combined indicator
  return data.armor.KinArmorFront + data.armor.HeatArmorFront;
}

function extractOpticsGround(data: UnitDetailData): number | null {
  const s = data.sensors[0];
  if (!s) return null;
  return Math.round(s.OpticsGround * 2);
}

function extractOpticsLow(data: UnitDetailData): number | null {
  const s = data.sensors[0];
  if (!s) return null;
  return Math.round(s.OpticsLowAltitude * 2);
}

function extractOpticsHigh(data: UnitDetailData): number | null {
  const s = data.sensors[0];
  if (!s) return null;
  return Math.round(s.OpticsHighAltitude * 2);
}

function extractTopSpeed(data: UnitDetailData): number | null {
  if (!data.mobility) return null;
  return Math.max(
    data.mobility.MaxSpeedRoad || 0,
    data.mobility.MaxCrossCountrySpeed || 0,
  );
}

function extractLongestRange(data: UnitDetailData): number | null {
  if (data.weapons.length === 0) return null;
  let maxRange = 0;
  for (const w of data.weapons) {
    for (const a of w.ammunition) {
      const r = a.ammunition.GroundRange || 0;
      if (r > maxRange) maxRange = r;
    }
  }
  return maxRange > 0 ? maxRange : null;
}

function extractEcm(data: UnitDetailData): number | null {
  const ecm = data.abilities.find(a => a.ECMAccuracyMultiplier > 0 && a.ECMAccuracyMultiplier < 1);
  if (!ecm) return null;
  return Math.round((1 - ecm.ECMAccuracyMultiplier) * 100);
}

/* ── Metric registry ─────────────────────────────────────────────── */

export const COMPARE_METRICS: CompareMetricDef[] = [
  { i18nKey: 'compare.metric.cost', extract: d => d.totalCost, betterWhen: 'lower' },
  { i18nKey: 'compare.metric.hp', extract: d => d.armor?.MaxHealthPoints ?? null, betterWhen: 'higher' },
  { i18nKey: 'compare.metric.armorGeneral', extract: extractArmorGeneral, betterWhen: 'higher' },
  { i18nKey: 'compare.metric.armorFront', extract: extractArmorFront, betterWhen: 'higher' },
  { i18nKey: 'compare.metric.stealth', extract: extractStealth, betterWhen: 'higher' },
  { i18nKey: 'compare.metric.opticsGround', extract: extractOpticsGround, betterWhen: 'higher' },
  { i18nKey: 'compare.metric.opticsLow', extract: extractOpticsLow, betterWhen: 'higher' },
  { i18nKey: 'compare.metric.opticsHigh', extract: extractOpticsHigh, betterWhen: 'higher' },
  { i18nKey: 'compare.metric.speed', extract: extractTopSpeed, betterWhen: 'higher' },
  { i18nKey: 'compare.metric.longestRange', extract: extractLongestRange, betterWhen: 'higher' },
  { i18nKey: 'compare.metric.ecm', extract: extractEcm, betterWhen: 'higher' },
];

/* ── Compare runner ──────────────────────────────────────────────── */

function formatVal(v: number | null, suffix?: string): string {
  if (v === null) return '—';
  return suffix ? `${v}${suffix}` : String(v);
}

const SUFFIX_MAP: Record<string, string> = {
  'compare.metric.opticsGround': 'm',
  'compare.metric.opticsLow': 'm',
  'compare.metric.opticsHigh': 'm',
  'compare.metric.speed': ' km/h',
  'compare.metric.longestRange': 'm',
  'compare.metric.ecm': '%',
};

export function compareUnits(a: UnitDetailData, b: UnitDetailData): CompareResult[] {
  return COMPARE_METRICS.map(metric => {
    const valA = metric.extract(a);
    const valB = metric.extract(b);
    const suffix = SUFFIX_MAP[metric.i18nKey] ?? '';

    let winner: CompareResult['winner'] = null;
    if (valA !== null && valB !== null) {
      if (valA === valB) {
        winner = 'equal';
      } else if (metric.betterWhen === 'higher') {
        winner = valA > valB ? 'a' : 'b';
      } else {
        winner = valA < valB ? 'a' : 'b';
      }
    }

    return {
      i18nKey: metric.i18nKey,
      valueA: valA,
      valueB: valB,
      winner,
      displayA: formatVal(valA, suffix),
      displayB: formatVal(valB, suffix),
    };
  }).filter(r => r.valueA !== null || r.valueB !== null); // omit metrics where both are N/A
}

/* ── Summary builder for share/embed ─────────────────────────────── */

export interface UnitShareSummary {
  displayName: string;
  cost: number;
  hp: number | null;
  armorLabel: string;
  armorValue: string;
  topSpeed: string;
  weapons: string[];
}

export function buildShareSummary(data: UnitDetailData): UnitShareSummary {
  const hp = data.armor?.MaxHealthPoints ?? null;
  const isDirArmor = hasDirArmor(data);

  let armorLabel: string;
  let armorValue: string;
  if (!data.armor) {
    armorLabel = 'compare.metric.armorGeneral';
    armorValue = '—';
  } else if (isDirArmor) {
    armorLabel = 'compare.metric.armorFront';
    armorValue = `KE ${data.armor.KinArmorFront} / HEAT ${data.armor.HeatArmorFront}`;
  } else {
    armorLabel = 'compare.metric.armorGeneral';
    armorValue = String(data.armor.ArmorValue);
  }

  const speed = extractTopSpeed(data);

  // Weapon names (unique, max 4)
  const weaponNames: string[] = [];
  for (const w of data.weapons) {
    const name = w.weapon.HUDName;
    if (name && !weaponNames.includes(name)) weaponNames.push(name);
    if (weaponNames.length >= 4) break;
  }

  return {
    displayName: data.displayName,
    cost: data.totalCost,
    hp,
    armorLabel,
    armorValue,
    topSpeed: speed ? `${speed} km/h` : '—',
    weapons: weaponNames,
  };
}
