// ══════════════════════════════════════════════════════════════
// Range calculator — computes unit range circles from unit detail data
// Ported from legacy UnitRangeDisplay.tsx calculateUnitRanges()
//
// Improvements over initial port:
//   • Groups by **weapon name** (HUDName) instead of ammunition name
//     — fewer labels, less noise, more tactically useful
//   • Deduplicates weapons that share the same range distance
//   • Preserves `category` (RangeCategory) so the UI can filter
//     by weapons / optics / laser independently
// ══════════════════════════════════════════════════════════════

import type { RangeCircle, RangeCategory, UnitRangeFilter, OpticsStealthConfig } from './types';
import { TERRAIN_COVER_MULTIPLIER } from './types';
import type { UnitDetailData } from '~/lib/graphql-types';
import { RANGE_COLORS, AMMO_RANGE_COLORS } from './constants';

// ── Internal types ──

interface RangeEntry {
  radiusMeters: number;
  color: string;
  label: string;
  priority: number;  // 1 = weapon (highest), 2 = optics, 3 = laser
  category: RangeCategory;
  sources: string[];
  weaponName?: string;
  altitudeType?: 'ground' | 'lowAlt' | 'highAlt';
  opticsType?: 'G' | 'L' | 'H' | 'RL' | 'RH';
}

// ── Main calculator ──

/**
 * Calculate all range circles for a unit based on its sensors, abilities, and weapons.
 *
 * Priority merging: when multiple range types share the same distance,
 * they are combined into a single circle using the highest-priority color.
 * Priority: weapons (1) > optics (2) > laser (3).
 *
 * @param detail  Full unit detail data from the unitDetail GraphQL query
 * @returns Array of RangeCircle (with `category`) ready for canvas rendering
 */
export function calculateUnitRanges(detail: UnitDetailData): RangeCircle[] {
  const { sensors, abilities, weapons } = detail;

  const allRanges: RangeEntry[] = [];

  // Use first sensor as main sensor (legacy uses unitDetails.mainSensor)
  const mainSensor = sensors.length > 0 ? sensors[0] : null;

  // Use first default ability (legacy uses unitDetails.abilities as singular)
  const defaultAbility = abilities.find(a => a.IsDefault) ?? (abilities.length > 0 ? abilities[0] : null);

  // ── 1. Laser range ──
  if (defaultAbility?.IsLaserDesignator && defaultAbility.LaserMaxRange) {
    const laserRange = defaultAbility.LaserMaxRange * 2;
    allRanges.push({
      radiusMeters: laserRange,
      color: RANGE_COLORS.LASER,
      label: 'LASER',
      priority: 3,
      category: 'laser',
      sources: ['LASER'],
    });
  }

  // ── 2. Optics ranges ──
  if (mainSensor) {
    const groundRange = mainSensor.OpticsGround * 2;
    if (groundRange > 0) {
      allRanges.push({
        radiusMeters: groundRange,
        color: RANGE_COLORS.OPTICS_GROUND,
        label: 'G',
        priority: 2,
        category: 'optics',
        sources: ['G'],
        opticsType: 'G',
      });
    }

    const lowAltRange = mainSensor.OpticsLowAltitude * 2;
    if (lowAltRange > 0) {
      allRanges.push({
        radiusMeters: lowAltRange,
        color: RANGE_COLORS.OPTICS_LOW_ALT,
        label: 'L',
        priority: 2,
        category: 'optics',
        sources: ['L'],
        opticsType: 'L',
      });
    }

    const highAltRange = mainSensor.OpticsHighAltitude * 2;
    if (highAltRange > 0) {
      allRanges.push({
        radiusMeters: highAltRange,
        color: RANGE_COLORS.OPTICS_HIGH_ALT,
        label: 'H',
        priority: 2,
        category: 'optics',
        sources: ['H'],
        opticsType: 'H',
      });
    }

    // Radar-enhanced optics
    if (defaultAbility?.IsRadar) {
      const radarLowAlt = Math.round(
        mainSensor.OpticsLowAltitude * 2 * (defaultAbility.RadarLowAltOpticsModifier || 1),
      );
      if (radarLowAlt > lowAltRange) {
        allRanges.push({
          radiusMeters: radarLowAlt,
          color: RANGE_COLORS.RADAR_LOW,
          label: 'RL',
          priority: 2,
          category: 'optics',
          sources: ['RL'],
          opticsType: 'RL' as const,
        });
      }

      const radarHighAlt = Math.round(
        mainSensor.OpticsHighAltitude * 2 * (defaultAbility.RadarHighAltOpticsModifier || 1),
      );
      if (radarHighAlt > highAltRange) {
        allRanges.push({
          radiusMeters: radarHighAlt,
          color: RANGE_COLORS.RADAR_HIGH,
          label: 'RH',
          priority: 2,
          category: 'optics',
          sources: ['RH'],
          opticsType: 'RH' as const,
        });
      }
    }
  }

  // ── 3. Weapon ranges — deduplicated per weapon name ──
  // Multiple weapon entries can share the same HUDName (e.g. 2× AMRAAM launchers).
  // We aggregate max ranges across ALL entries with the same name first,
  // then emit only distinct range values per weapon (no altitude suffix labels —
  // users can deduce altitude context). altitudeType metadata is kept for the
  // "show all altitudes" toggle.
  if (weapons.length > 0) {
    let colorIndex = 0;
    const weaponColorMap = new Map<string, string>();

    // Step 1: aggregate max ranges per weapon name across all entries
    const weaponMaxRanges = new Map<string, { ground: number; lowAlt: number; highAlt: number }>();

    for (const entry of weapons) {
      const weaponName = entry.weapon.HUDName || entry.weapon.Name;

      if (!weaponColorMap.has(weaponName)) {
        weaponColorMap.set(weaponName, AMMO_RANGE_COLORS[colorIndex % AMMO_RANGE_COLORS.length]);
        colorIndex++;
      }

      const existing = weaponMaxRanges.get(weaponName) ?? { ground: 0, lowAlt: 0, highAlt: 0 };

      for (const ammoSlot of entry.ammunition) {
        const ammo = ammoSlot.ammunition;
        const g = (ammo.GroundRange || 0) * 2;
        const l = (ammo.LowAltRange || 0) * 2;
        const h = (ammo.HighAltRange || 0) * 2;
        if (g > existing.ground) existing.ground = g;
        if (l > existing.lowAlt) existing.lowAlt = l;
        if (h > existing.highAlt) existing.highAlt = h;
      }

      weaponMaxRanges.set(weaponName, existing);
    }

    // Step 2: emit deduplicated entries per weapon
    for (const [weaponName, ranges] of weaponMaxRanges) {
      const color = weaponColorMap.get(weaponName)!;
      const { ground, lowAlt, highAlt } = ranges;

      // Emit one entry per non-zero altitude type (enables per-altitude filtering)
      const altEntries: { alt: 'ground' | 'lowAlt' | 'highAlt'; range: number }[] = [];
      if (ground > 0) altEntries.push({ alt: 'ground', range: ground });
      if (lowAlt > 0) altEntries.push({ alt: 'lowAlt', range: lowAlt });
      if (highAlt > 0) altEntries.push({ alt: 'highAlt', range: highAlt });

      for (const { alt, range } of altEntries) {
        allRanges.push({
          radiusMeters: range,
          color,
          label: weaponName,
          priority: 1,
          category: 'weapon',
          sources: [weaponName],
          weaponName,
          altitudeType: alt,
        });
      }
    }
  }

  // ── 4. Merge same-distance ranges ──
  // When different category ranges share a distance, combine into one circle
  // using the highest-priority color but keeping all source labels.
  // Weapon ranges are kept individual (not merged with each other) so per-weapon
  // filtering works. Only cross-category merges happen.
  const groups = new Map<number, RangeEntry[]>();
  for (const entry of allRanges) {
    const key = entry.radiusMeters;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  const finalRanges: RangeCircle[] = [];

  groups.forEach((group, radiusMeters) => {
    // Sort by priority (weapons first = lowest number)
    group.sort((a, b) => a.priority - b.priority);

    // Separate weapon, optics, and other entries
    const weaponEntries = group.filter(e => e.category === 'weapon');
    const opticsEntries = group.filter(e => e.category === 'optics');
    const otherEntries = group.filter(e => e.category !== 'weapon' && e.category !== 'optics');

    // Emit each weapon entry individually (preserves per-weapon identity)
    for (const wep of weaponEntries) {
      finalRanges.push({
        radiusMeters,
        color: wep.color,
        label: wep.label,
        category: 'weapon',
        weaponName: wep.weaponName,
        altitudeType: wep.altitudeType,
      });
    }

    // Emit each optics entry individually (preserves per-band identity)
    for (const opt of opticsEntries) {
      finalRanges.push({
        radiusMeters,
        color: opt.color,
        label: opt.label,
        category: 'optics',
        opticsType: opt.opticsType,
      });
    }

    // Merge remaining entries (laser etc.) at this distance into one circle
    if (otherEntries.length > 0) {
      const primary = otherEntries[0];
      const allSources = otherEntries.flatMap(item => item.sources);
      finalRanges.push({
        radiusMeters,
        color: primary.color,
        label: allSources.join(' + '),
        category: primary.category,
      });
    }
  });

  // Sort by radius ascending for rendering order
  finalRanges.sort((a, b) => a.radiusMeters - b.radiusMeters);

  return finalRanges;
}

/**
 * Apply a per-unit range filter to a set of range circles.
 * Returns only the circles whose category is enabled.
 *
 * Weapon filtering:
 *   - Per-weapon toggle via `filter.disabledWeapons[]`
 *   - Altitude collapsing: when `filter.showAllAltitudes` is false (default),
 *     only the max-range entry per weapon is shown. When true, all altitude
 *     bands are shown.
 *
 * When `stealthCfg` is provided, optics circles have their radius adjusted:
 *   effective_range = base_range / (stealth × terrain_multiplier)
 */
export function filterRanges(
  ranges: RangeCircle[],
  filter: UnitRangeFilter,
  stealthCfg?: OpticsStealthConfig,
): RangeCircle[] {
  let result = ranges
    .filter(r => {
      if (r.category === 'weapon') {
        if (!filter.weapons) return false;
        // Per-weapon filter
        if (r.weaponName && filter.disabledWeapons?.includes(r.weaponName)) return false;
        return true;
      }
      if (r.category === 'optics') return filter.optics;
      if (r.category === 'laser') return filter.laser;
      return true;
    });

  // Per-weapon altitude filtering: remove entries whose weapon+altitude combo is disabled.
  if (filter.disabledWeaponAltitudes) {
    const disabled = filter.disabledWeaponAltitudes;
    result = result.filter(r => {
      if (r.category === 'weapon' && r.weaponName && r.altitudeType) {
        const disabledAlts = disabled[r.weaponName];
        if (disabledAlts && disabledAlts.includes(r.altitudeType)) return false;
      }
      return true;
    });
  }

  // Optics collapsing: when showAllOptics is false (default),
  // keep only the longest-range optics band.
  if (!filter.showAllOptics) {
    let maxOpticsRange = 0;
    for (const r of result) {
      if (r.category === 'optics' && r.radiusMeters > maxOpticsRange) {
        maxOpticsRange = r.radiusMeters;
      }
    }
    if (maxOpticsRange > 0) {
      result = result.filter(r => {
        if (r.category === 'optics') return r.radiusMeters === maxOpticsRange;
        return true;
      });
    }
  }

  // Apply stealth simulation to optics circles ONLY.
  // Laser and weapon circles are never affected by stealth.
  // Terrain cover (forest/building) only affects ground optics — aircraft
  // at low/high altitude don't benefit from ground terrain concealment.
  result = result.map(r => {
    if (r.category !== 'optics' || !stealthCfg) return r;
    const isGround = r.opticsType === 'G';
    const terrainDiv = isGround ? TERRAIN_COVER_MULTIPLIER[stealthCfg.terrain] : 1;
    const divisor = stealthCfg.stealth * terrainDiv;
    if (divisor === 1) return r;
    const effectiveRadius = Math.round(r.radiusMeters / divisor);
    if (effectiveRadius === r.radiusMeters) return r;
    return { ...r, radiusMeters: effectiveRadius };
  });

  // Consolidate same-distance weapon entries into a single label.
  // E.g. three weapons at 450m → "450m G3, HK 79N, Carl Gustaf M2"
  const weaponGroups = new Map<number, RangeCircle[]>();
  const nonWeapon: RangeCircle[] = [];
  for (const r of result) {
    if (r.category === 'weapon') {
      if (!weaponGroups.has(r.radiusMeters)) weaponGroups.set(r.radiusMeters, []);
      weaponGroups.get(r.radiusMeters)!.push(r);
    } else {
      nonWeapon.push(r);
    }
  }
  const consolidated: RangeCircle[] = [...nonWeapon];
  for (const [, group] of weaponGroups) {
    const names = group.map(r => r.label);
    const uniqueNames = [...new Set(names)];
    const label = uniqueNames.length > 3
      ? `${uniqueNames.slice(0, 3).join(', ')}…`
      : uniqueNames.join(', ');
    consolidated.push({
      radiusMeters: group[0].radiusMeters,
      color: group[0].color,
      label,
      category: 'weapon',
    });
  }

  return consolidated;
}

/** Default range filter — all categories visible */
export const DEFAULT_RANGE_FILTER: UnitRangeFilter = {
  weapons: true,
  optics: true,
  laser: true,
  disabledWeapons: [],
  disabledWeaponAltitudes: {},
  showAllOptics: false,
};

/**
 * Extract unique weapon names from a set of range circles.
 * Useful for building per-weapon toggle UI.
 */
export function getWeaponNamesFromRanges(ranges: RangeCircle[]): string[] {
  const names = new Set<string>();
  for (const r of ranges) {
    if (r.category === 'weapon' && r.weaponName) {
      names.add(r.weaponName);
    }
  }
  return Array.from(names);
}

/**
 * Extract which altitude types each weapon has from the raw range circles.
 * Returns a map: weaponName → sorted array of altitude type strings.
 * Only includes weapons with ≥2 altitude types (single-altitude weapons need no sub-toggles).
 */
export function getWeaponAltitudesFromRanges(ranges: RangeCircle[]): Record<string, string[]> {
  const weaponAlts = new Map<string, Set<string>>();
  for (const r of ranges) {
    if (r.category === 'weapon' && r.weaponName && r.altitudeType) {
      if (!weaponAlts.has(r.weaponName)) weaponAlts.set(r.weaponName, new Set());
      weaponAlts.get(r.weaponName)!.add(r.altitudeType);
    }
  }
  const result: Record<string, string[]> = {};
  const order = ['ground', 'lowAlt', 'highAlt'];
  for (const [name, alts] of weaponAlts) {
    if (alts.size >= 2) {
      result[name] = [...alts].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }
  }
  return result;
}

/**
 * Build default disabled altitude map for a set of range circles.
 * For each weapon with multiple altitude types, disables all altitudes
 * except those at the maximum range distance. If multiple altitudes share
 * the same highest range, they all stay enabled.
 */
export function buildDefaultDisabledAltitudes(ranges: RangeCircle[]): Record<string, string[]> {
  // Collect altitude → range for each weapon
  const weaponAltRanges = new Map<string, { alt: string; range: number }[]>();
  for (const r of ranges) {
    if (r.category === 'weapon' && r.weaponName && r.altitudeType) {
      if (!weaponAltRanges.has(r.weaponName)) weaponAltRanges.set(r.weaponName, []);
      weaponAltRanges.get(r.weaponName)!.push({ alt: r.altitudeType, range: r.radiusMeters });
    }
  }
  const result: Record<string, string[]> = {};
  for (const [name, entries] of weaponAltRanges) {
    if (entries.length < 2) continue;
    const maxRange = Math.max(...entries.map(e => e.range));
    const disabled = entries.filter(e => e.range < maxRange).map(e => e.alt);
    if (disabled.length > 0) {
      result[name] = disabled;
    }
  }
  return result;
}

/**
 * Check whether a unit has multiple distinct optics bands.
 * Returns true if there are ≥2 optics entries with different ranges.
 */
export function hasMultipleOptics(ranges: RangeCircle[]): boolean {
  const opticsRanges = new Set<number>();
  for (const r of ranges) {
    if (r.category === 'optics' && r.opticsType) {
      opticsRanges.add(r.radiusMeters);
    }
  }
  return opticsRanges.size > 1;
}
