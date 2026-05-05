import { describe, it, expect } from 'vitest';
import {
  compareUnits,
  buildShareSummary,
  COMPARE_METRICS,
} from './compare';
import type { UnitDetailData } from './graphql-types';

/* ── Minimal test fixtures ───────────────────────────────────────
 * Only the fields exercised by compare/share logic are populated.
 * Everything else uses safe defaults.
 * ─────────────────────────────────────────────────────────────── */

function makeUnit(overrides: Partial<{
  id: number;
  name: string;
  cost: number;
  hp: number;
  armorValue: number;
  kinFront: number;
  heatFront: number;
  kinRear: number;
  heatRear: number;
  stealth: number;
  optGround: number;
  optLow: number;
  optHigh: number;
  speedRoad: number;
  speedOffroad: number;
  ecm: number;
  weapons: Array<{ name: string; range: number }>;
  categoryType: number;
}>): UnitDetailData {
  const o = {
    id: 1,
    name: 'TestUnit',
    cost: 100,
    hp: 10,
    armorValue: 0,
    kinFront: 0,
    heatFront: 0,
    kinRear: 0,
    heatRear: 0,
    stealth: 1,
    optGround: 100,
    optLow: 50,
    optHigh: 25,
    speedRoad: 60,
    speedOffroad: 40,
    ecm: 0,
    weapons: [],
    categoryType: 2,
    ...overrides,
  };

  const abilities: UnitDetailData['abilities'] = [];
  if (o.ecm > 0) {
    abilities.push({
      Id: 99, Name: 'ECM', IsDefault: true,
      ECMAccuracyMultiplier: 1 - o.ecm / 100,
      IsRadar: false, RadarLowAltOpticsModifier: 0, RadarHighAltOpticsModifier: 0,
      RadarLowAltWeaponRangeModifier: 0, RadarHighAltWeaponRangeModifier: 0,
      IsRadarStatic: false, RadarSwitchCooldown: 0,
      IsLaserDesignator: false, LaserMaxRange: 0, LaserUsableInMove: false,
      IsInfantrySprint: false, SprintDuration: 0, SprintCooldown: 0,
      IsSmoke: false, SmokeAmmunitionQuantity: 0, SmokeCooldown: 0,
      IsAPS: false, APSQuantity: 0, APSCooldown: 0, APSHitboxProportion: 0, APSSupplyCost: 0, APSResupplyTime: 0,
      IsDecoy: false, DecoyQuantity: 0, DecoyAccuracyMultiplier: 0,
      DecoyCooldown: 0, DecoyDuration: 0, DecoySupplyCost: 0, DecoyResupplyTime: 0,
    });
  }

  return {
    displayName: o.name,
    totalCost: o.cost,
    unit: {
      Id: o.id, Name: o.name, HUDName: o.name, Description: '',
      CountryId: 1, Type: 0, CategoryType: o.categoryType, Role: 0, Cost: o.cost,
      PortraitFileName: '', ThumbnailFileName: '',
      Weight: 1000, Stealth: o.stealth, InfantrySlots: 0, MaxStress: 100,
      Length: 5, Width: 3, Height: 2,
      DisplayInArmory: true, IsUnitModification: false,
    },
    baseUnit: { Id: o.id, Name: o.name, Cost: o.cost },
    country: { Id: 1, Name: 'TestCountry', FlagFileName: 'test' },
    armor: {
      Id: 1, Name: 'armor', ArmorValue: o.armorValue, MaxHealthPoints: o.hp,
      HeatArmorFront: o.heatFront, HeatArmorRear: o.heatRear, HeatArmorSides: 0, HeatArmorTop: 0,
      KinArmorFront: o.kinFront, KinArmorRear: o.kinRear, KinArmorSides: 0, KinArmorTop: 0,
    },
    mobility: {
      Id: 1, Name: 'mob', IsAmphibious: false, IsAirDroppable: false,
      Weight: 1000, HeavyLiftWeight: 0, TurnRate: 30, Acceleration: 5,
      MaxCrossCountrySpeed: o.speedOffroad, MaxSpeedRoad: o.speedRoad,
      MaxSpeedReverse: 20, MaxSpeedWater: 0, Agility: 10, ClimbRate: 0,
      IsChangeAltitude: false, LoiteringTime: 0, IsAfterburner: false, AfterBurningLoiteringTime: 0,
    },
    flyPreset: null,
    sensors: [{
      Id: 1, Name: 'optics',
      OpticsGround: o.optGround / 2,
      OpticsLowAltitude: o.optLow / 2,
      OpticsHighAltitude: o.optHigh / 2,
    }],
    abilities,
    weapons: o.weapons.map((w, i) => ({
      weapon: {
        Id: i + 1, Name: w.name, HUDName: w.name, Type: 0, HUDIcon: '',
        AutoLoaded: false, IsVerticalLauncher: false, CanShootOnTheMove: false,
        MagazineSize: 10, MagazineReloadTimeMin: 5, MagazineReloadTimeMax: 5,
        AimTimeMin: 1, AimTimeMax: 2,
        ShotsPerBurstMin: 1, ShotsPerBurstMax: 1,
        TimeBetweenShotsInBurst: 0, TimeBetweenBurstsMin: 3, TimeBetweenBurstsMax: 3,
        MultiTargetTracking: 0, SimultaneousTracking: 0,
        CanBeMerged: false, StabilizerQuality: 0,
      },
      turret: null,
      ammunition: [{
        order: 0, quantity: 10,
        ammunition: {
          Id: i + 1, Name: `${w.name}_ammo`, HUDName: '', HUDIcon: '',
          Damage: 100, StressDamage: 10, PenetrationAtMinRange: 50, PenetrationAtGroundRange: 40,
          GroundRange: w.range, LowAltRange: 0, HighAltRange: 0, MinimalRange: 0,
          TargetType: 0, ArmorTargeted: 0, TrajectoryType: 0,
          TopArmorAttack: false, IsTopArmorArmorAttack: false, LaserGuided: false, CanBeIntercepted: false,
          NoDamageFalloff: false, IgnoreCover: 0,
          HealthAOERadius: 0, StressAOERadius: 0, OverpressureRadius: 0,
          RadioFuseDistance: 0, DamageOverTimeDuration: 0,
          MuzzleVelocity: 900, MaxSpeed: 0,
          DispersionHorizontalRadius: 0, DispersionVerticalRadius: 0,
          SupplyCost: 5, ResupplyTime: 30,
          GenerateSmoke: false, Seeker: 0, SeekerAngle: 0,
          MaxSeekerDistance: 0, CanBeTargeted: false, CanReaquire: false,
          AimStartDelay: 0, MainEngineIgnitionDelay: 0,
          RotationSpeed: 0, BurnTime: 0, Airburst: false,
          HUDMultiplier: 1, CriticMultiplier: 1,
        },
      }],
    })),
    modifications: [],
    squadMembers: [],
    availability: [],
    transportFor: null,
  };
}

// ── compareUnits ────────────────────────────────────────────────

describe('compareUnits', () => {
  it('returns results for all applicable metrics', () => {
    const a = makeUnit({ name: 'Alpha', cost: 80, hp: 100, armorValue: 5, weapons: [{ name: 'Gun', range: 1000 }] });
    const b = makeUnit({ name: 'Bravo', cost: 120, hp: 80, armorValue: 3, weapons: [{ name: 'Cannon', range: 1500 }] });
    const results = compareUnits(a, b);

    // Should have results (at least cost, hp, armor, stealth, optics, speed)
    expect(results.length).toBeGreaterThanOrEqual(6);
  });

  it('determines cost winner correctly (lower is better)', () => {
    const a = makeUnit({ cost: 80 });
    const b = makeUnit({ cost: 120 });
    const results = compareUnits(a, b);
    const costResult = results.find(r => r.i18nKey === 'compare.metric.cost');

    expect(costResult).toBeDefined();
    expect(costResult!.winner).toBe('a'); // 80 < 120 → A wins
    expect(costResult!.valueA).toBe(80);
    expect(costResult!.valueB).toBe(120);
  });

  it('determines HP winner correctly (higher is better)', () => {
    const a = makeUnit({ hp: 100 });
    const b = makeUnit({ hp: 200 });
    const results = compareUnits(a, b);
    const hpResult = results.find(r => r.i18nKey === 'compare.metric.hp');

    expect(hpResult).toBeDefined();
    expect(hpResult!.winner).toBe('b'); // 200 > 100 → B wins
  });

  it('returns equal when values match', () => {
    const a = makeUnit({ cost: 100, hp: 50 });
    const b = makeUnit({ cost: 100, hp: 50 });
    const results = compareUnits(a, b);
    const costResult = results.find(r => r.i18nKey === 'compare.metric.cost');

    expect(costResult!.winner).toBe('equal');
  });

  it('uses general armor for non-vehicle units', () => {
    const a = makeUnit({ armorValue: 5 });
    const b = makeUnit({ armorValue: 3 });
    const results = compareUnits(a, b);
    const armorGeneral = results.find(r => r.i18nKey === 'compare.metric.armorGeneral');

    expect(armorGeneral).toBeDefined();
    expect(armorGeneral!.winner).toBe('a'); // 5 > 3
  });

  it('uses frontal armor for vehicle units with directional armor', () => {
    const a = makeUnit({ kinFront: 10, heatFront: 5, kinRear: 2, heatRear: 1 });
    const b = makeUnit({ kinFront: 8, heatFront: 3, kinRear: 1, heatRear: 0 });
    const results = compareUnits(a, b);
    const armorFront = results.find(r => r.i18nKey === 'compare.metric.armorFront');

    expect(armorFront).toBeDefined();
    expect(armorFront!.valueA).toBe(15); // 10 + 5
    expect(armorFront!.valueB).toBe(11); // 8 + 3
    expect(armorFront!.winner).toBe('a');
  });

  it('compares optics correctly', () => {
    const a = makeUnit({ optGround: 200 });
    const b = makeUnit({ optGround: 300 });
    const results = compareUnits(a, b);
    const optGround = results.find(r => r.i18nKey === 'compare.metric.opticsGround');

    expect(optGround).toBeDefined();
    expect(optGround!.winner).toBe('b'); // 300 > 200
    expect(optGround!.displayA).toBe('200m');
    expect(optGround!.displayB).toBe('300m');
  });

  it('compares longest weapon range', () => {
    const a = makeUnit({ weapons: [{ name: 'Short', range: 500 }, { name: 'Long', range: 2000 }] });
    const b = makeUnit({ weapons: [{ name: 'Mid', range: 1200 }] });
    const results = compareUnits(a, b);
    const range = results.find(r => r.i18nKey === 'compare.metric.longestRange');

    expect(range).toBeDefined();
    expect(range!.valueA).toBe(2000);
    expect(range!.valueB).toBe(1200);
    expect(range!.winner).toBe('a');
    expect(range!.displayA).toBe('2000m');
  });

  it('compares ECM when present', () => {
    const a = makeUnit({ ecm: 40 });
    const b = makeUnit({ ecm: 0 });
    const results = compareUnits(a, b);
    const ecm = results.find(r => r.i18nKey === 'compare.metric.ecm');

    // B has no ECM, so ecm result for B is null — might be filtered
    expect(ecm).toBeDefined();
    expect(ecm!.valueA).toBe(40);
  });

  it('filters out metrics where both values are null', () => {
    const a = makeUnit({ weapons: [] });
    const b = makeUnit({ weapons: [] });
    const results = compareUnits(a, b);
    const range = results.find(r => r.i18nKey === 'compare.metric.longestRange');

    expect(range).toBeUndefined(); // both null → omitted
  });

  it('compares stealth (higher processed value is better)', () => {
    const a = makeUnit({ stealth: 0.5 }); // 1/0.5 = 2.0
    const b = makeUnit({ stealth: 2.0 }); // 1/2.0 = 0.5
    const results = compareUnits(a, b);
    const stealth = results.find(r => r.i18nKey === 'compare.metric.stealth');

    expect(stealth).toBeDefined();
    expect(stealth!.winner).toBe('a'); // 2.0 > 0.5
  });

  it('compares speed (higher is better)', () => {
    const a = makeUnit({ speedRoad: 80, speedOffroad: 40 });
    const b = makeUnit({ speedRoad: 60, speedOffroad: 50 });
    const results = compareUnits(a, b);
    const speed = results.find(r => r.i18nKey === 'compare.metric.speed');

    expect(speed).toBeDefined();
    expect(speed!.valueA).toBe(80); // max(80, 40)
    expect(speed!.valueB).toBe(60); // max(60, 50)
    expect(speed!.winner).toBe('a');
  });
});

// ── COMPARE_METRICS registry ────────────────────────────────────

describe('COMPARE_METRICS', () => {
  it('has at least 10 metrics defined', () => {
    expect(COMPARE_METRICS.length).toBeGreaterThanOrEqual(10);
  });

  it('every metric has an i18n key, extract fn, and direction', () => {
    for (const metric of COMPARE_METRICS) {
      expect(metric.i18nKey).toMatch(/^compare\.metric\./);
      expect(typeof metric.extract).toBe('function');
      expect(['lower', 'higher']).toContain(metric.betterWhen);
    }
  });

  it('cost is the only metric where lower is better', () => {
    const lowerMetrics = COMPARE_METRICS.filter(m => m.betterWhen === 'lower');
    expect(lowerMetrics).toHaveLength(1);
    expect(lowerMetrics[0].i18nKey).toBe('compare.metric.cost');
  });
});

// ── buildShareSummary ───────────────────────────────────────────

describe('buildShareSummary', () => {
  it('returns displayName and cost', () => {
    const unit = makeUnit({ name: 'M1 Abrams', cost: 150 });
    const summary = buildShareSummary(unit);

    expect(summary.displayName).toBe('M1 Abrams');
    expect(summary.cost).toBe(150);
  });

  it('returns HP from armor', () => {
    const unit = makeUnit({ hp: 200 });
    const summary = buildShareSummary(unit);

    expect(summary.hp).toBe(200);
  });

  it('uses general armor label for non-directional armor', () => {
    const unit = makeUnit({ armorValue: 5 });
    const summary = buildShareSummary(unit);

    expect(summary.armorLabel).toBe('compare.metric.armorGeneral');
    expect(summary.armorValue).toBe('5');
  });

  it('uses frontal armor label for directional armor', () => {
    const unit = makeUnit({ kinFront: 10, heatFront: 5, kinRear: 2, heatRear: 1 });
    const summary = buildShareSummary(unit);

    expect(summary.armorLabel).toBe('compare.metric.armorFront');
    expect(summary.armorValue).toBe('KE 10 / HEAT 5');
  });

  it('returns top speed', () => {
    const unit = makeUnit({ speedRoad: 80, speedOffroad: 40 });
    const summary = buildShareSummary(unit);

    expect(summary.topSpeed).toBe('80 km/h');
  });

  it('returns up to 4 unique weapon names', () => {
    const unit = makeUnit({
      weapons: [
        { name: 'MG', range: 500 },
        { name: 'Cannon', range: 2000 },
        { name: 'MG', range: 500 }, // duplicate
        { name: 'ATGM', range: 3000 },
        { name: 'Mortar', range: 4000 },
        { name: 'SAM', range: 5000 }, // 5th unique, should be excluded
      ],
    });
    const summary = buildShareSummary(unit);

    expect(summary.weapons).toEqual(['MG', 'Cannon', 'ATGM', 'Mortar']);
    expect(summary.weapons).toHaveLength(4);
  });

  it('returns empty weapons for unarmed units', () => {
    const unit = makeUnit({ weapons: [] });
    const summary = buildShareSummary(unit);

    expect(summary.weapons).toEqual([]);
  });

  it('returns dash for speed when no mobility', () => {
    const unit = makeUnit({});
    // Remove mobility
    (unit as any).mobility = null;
    const summary = buildShareSummary(unit);

    expect(summary.topSpeed).toBe('—');
  });
});

// ── Embed description generation (mirror of SSR logic) ──────────

describe('embed description generation', () => {
  /**
   * This replicates the SSR buildUnitDescription logic to test
   * how embeds will appear in Discord/Twitter previews.
   */
  function buildDescription(summary: ReturnType<typeof buildShareSummary>): string {
    const parts: string[] = [];
    parts.push(`Cost: ${summary.cost}`);
    if (summary.hp !== null) parts.push(`HP: ${summary.hp}`);
    // armorLabel would be resolved by i18n, here we simulate
    const armorLabelMap: Record<string, string> = {
      'compare.metric.armorGeneral': 'Armor',
      'compare.metric.armorFront': 'Frontal Armor',
    };
    parts.push(`${armorLabelMap[summary.armorLabel] ?? 'Armor'}: ${summary.armorValue}`);
    parts.push(`Speed: ${summary.topSpeed}`);
    if (summary.weapons.length) parts.push(`Weapons: ${summary.weapons.join(', ')}`);
    return parts.join(' · ');
  }

  it('generates complete description for a MBT', () => {
    const unit = makeUnit({
      name: 'M1A2 Abrams',
      cost: 200,
      hp: 15,
      kinFront: 20, heatFront: 18, kinRear: 5, heatRear: 3,
      speedRoad: 67,
      weapons: [{ name: 'M256 120mm', range: 2800 }, { name: 'M240', range: 800 }],
    });
    const summary = buildShareSummary(unit);
    const desc = buildDescription(summary);

    expect(desc).toBe('Cost: 200 · HP: 15 · Frontal Armor: KE 20 / HEAT 18 · Speed: 67 km/h · Weapons: M256 120mm, M240');
  });

  it('generates description for infantry (no directional armor)', () => {
    const unit = makeUnit({
      name: 'Riflemen',
      cost: 30,
      hp: 10,
      armorValue: 1,
      speedRoad: 20,
      speedOffroad: 12,
      weapons: [{ name: 'M4', range: 400 }],
    });
    const summary = buildShareSummary(unit);
    const desc = buildDescription(summary);

    expect(desc).toBe('Cost: 30 · HP: 10 · Armor: 1 · Speed: 20 km/h · Weapons: M4');
  });

  it('handles unarmed units', () => {
    const unit = makeUnit({ name: 'Transport Truck', cost: 20, hp: 5, weapons: [] });
    const summary = buildShareSummary(unit);
    const desc = buildDescription(summary);

    expect(desc).toBe('Cost: 20 · HP: 5 · Armor: 0 · Speed: 60 km/h');
  });
});
