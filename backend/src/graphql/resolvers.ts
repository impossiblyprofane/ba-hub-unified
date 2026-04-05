import type { MercuriusContext, IResolvers } from 'mercurius';
import { GraphQLScalarType, Kind } from 'graphql';
import type { StaticData } from '../data/loader.js';
import type { StaticIndexes } from '../data/indexes.js';
import type { DatabaseClient, StatsLeaderboardEntry } from '../services/databaseClient.js';
import type {
  BrowseDecksFilter,
  PublishDeckInput,
  UpdatePublishedDeckInput,
  DeletePublishedDeckInput,
} from '@ba-hub/shared';
import { resolveMapName } from '../data/constants.js';

// ── Leaderboard response cache ──────────────────────────────
// Fully-resolved leaderboard (with KD/winRate enrichment) is cached
// for 5 minutes to avoid the expensive batch getPlayerStats on every
// page load. Cache key = `${start}:${end}`.
const leaderboardCache = new Map<string, { data: StatsLeaderboardEntry[]; expires: number }>();
const LEADERBOARD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

type GraphQLContext = MercuriusContext & {
  data: StaticData;
  indexes: StaticIndexes;
  dbClient: DatabaseClient;
};

type UnitWeaponSlot = {
  weapon: unknown;
  turret: unknown | null;
  ammunition: Array<{ ammunition: unknown; order: number; quantity: number }>;
};

type ArsenalDefaultModificationOption = {
  modId: number;
  optId: number;
  optCost: number;
  optRun: string | null;
  optCwun: string | null;
  type: number | null;
  optThumbnailOverride: string | null;
  optPortraitOverride: string | null;
};

type ArsenalUnitCard = {
  unit: unknown;
  isTransport: boolean;
  specializationIds: number[];
  transportCapacity: number;
  cargoCapacity: number;
  availableTransports: number[];
  defaultModificationOptions: ArsenalDefaultModificationOption[];
};

const isPositiveId = (value: number | null | undefined): value is number =>
  typeof value === 'number' && value > 0;

const uniqNumbers = (values: number[]) => Array.from(new Set(values)).sort((a, b) => a - b);

const normalizeSearch = (value: string) => value.trim().toLowerCase();

const matchesSearch = (value: string | null | undefined, search: string) =>
  typeof value === 'string' && value.toLowerCase().includes(search);

const withPagination = <T>(items: T[], offset = 0, limit = 50) =>
  items.slice(Math.max(offset, 0), Math.max(offset, 0) + Math.max(limit, 0));

const sortByOrder = <T extends { Order?: number }>(items: T[]) =>
  [...items].sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0));

const buildWeaponAmmoSlots = (unitId: number, weaponId: number, indexes: StaticIndexes) => {
  const weaponAmmos = indexes.weaponAmmunitionsByUnitId.get(unitId) ?? [];
  return sortByOrder(weaponAmmos)
    .filter(entry => entry.WeaponId === weaponId)
    .map(entry => {
      const ammunition = indexes.ammunitionsById.get(entry.AmmunitionId);
      if (!ammunition) {
        return null;
      }
      return {
        ammunition,
        order: entry.Order,
        quantity: entry.Quantity,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
};

const buildUnitWeapons = (unitId: number, indexes: StaticIndexes): UnitWeaponSlot[] => {
  const results: UnitWeaponSlot[] = [];
  const seenWeaponIds = new Set<number>();

  const turretUnits = sortByOrder(indexes.turretUnitsByUnitId.get(unitId) ?? []);
  for (const turretUnit of turretUnits) {
    const turret = indexes.turretsById.get(turretUnit.TurretId);
    if (!turret) {
      continue;
    }
    const turretWeapons = sortByOrder(indexes.turretWeaponsByTurretId.get(turret.Id) ?? []);
    for (const turretWeapon of turretWeapons) {
      const weapon = indexes.weaponsById.get(turretWeapon.WeaponId);
      if (!weapon) {
        continue;
      }
      seenWeaponIds.add(weapon.Id);
      results.push({
        weapon,
        turret,
        ammunition: buildWeaponAmmoSlots(unitId, weapon.Id, indexes),
      });
    }
  }

  const unitWeaponAmmos = indexes.weaponAmmunitionsByUnitId.get(unitId) ?? [];
  const weaponIds = uniqNumbers(unitWeaponAmmos.map(entry => entry.WeaponId));
  for (const weaponId of weaponIds) {
    if (seenWeaponIds.has(weaponId)) {
      continue;
    }
    const weapon = indexes.weaponsById.get(weaponId);
    if (!weapon) {
      continue;
    }
    results.push({
      weapon,
      turret: null,
      ammunition: buildWeaponAmmoSlots(unitId, weaponId, indexes),
    });
  }

  return results;
};

const buildArsenalUnitCard = (unitId: number, ctx: GraphQLContext): ArsenalUnitCard | null => {
  const { data, indexes } = ctx;
  const unit = indexes.unitsById.get(unitId);
  if (!unit) {
    return null;
  }

  const transportAvailabilities = indexes.transportAvailabilitiesByUnitId.get(unitId) ?? [];
  let validTransportAvailability = null as (typeof transportAvailabilities)[number] | null;

  for (const ta of transportAvailabilities) {
    if (indexes.specializationAvailabilitiesById.get(ta.SpecializationAvailabilityId)) {
      validTransportAvailability = ta;
      break;
    }
  }

  const unitPropulsion = (indexes.unitPropulsionsByUnitId.get(unitId) ?? [])[0];
  const mobility = unitPropulsion ? indexes.mobilityById.get(unitPropulsion.MobilityId) ?? null : null;

  const specAvailabilities = data.specializationAvailabilities.filter(sa => sa.UnitId === unitId);
  const specIds = specAvailabilities.map(sa => sa.SpecializationId);

  if (validTransportAvailability) {
    const sa = indexes.specializationAvailabilitiesById.get(validTransportAvailability.SpecializationAvailabilityId);
    if (sa) {
      specIds.push(sa.SpecializationId);
    }
  }

  const primarySpecAvailability = specAvailabilities[0];
  const availableTransports = primarySpecAvailability
    ? (indexes.transportAvailabilitiesBySpecAvailabilityId.get(primarySpecAvailability.Id) ?? [])
        .map(ta => ta.UnitId)
    : [];

  const modifications = indexes.modificationsByUnitId.get(unitId) ?? [];
  const defaultModificationOptions: ArsenalDefaultModificationOption[] = modifications.flatMap(mod => {
    const options = indexes.optionsByModificationId.get(mod.Id) ?? [];
    const defaultOption = options.find(opt => opt.IsDefault) ?? options[0];
    if (!defaultOption) {
      return [];
    }
    return [{
      modId: mod.Id,
      optId: defaultOption.Id,
      optCost: defaultOption.Cost ?? 0,
      optRun: defaultOption.ReplaceUnitName ?? null,
      optCwun: defaultOption.ConcatenateWithUnitName ?? null,
      type: mod.Type ?? null,
      optThumbnailOverride: defaultOption.ThumbnailOverride ?? null,
      optPortraitOverride: defaultOption.PortraitOverride ?? null,
    }];
  });

  return {
    unit,
    isTransport: Boolean(validTransportAvailability),
    specializationIds: specIds,
    transportCapacity: unit.InfantrySlots ?? 0,
    cargoCapacity: mobility?.HeavyLiftWeight ?? 0,
    availableTransports,
    defaultModificationOptions,
  };
};

const resolveOptionTurrets = (option: {
  Turret0Id?: number; Turret1Id?: number; Turret2Id?: number; Turret3Id?: number; Turret4Id?: number;
  Turret5Id?: number; Turret6Id?: number; Turret7Id?: number; Turret8Id?: number; Turret9Id?: number;
  Turret10Id?: number; Turret11Id?: number; Turret12Id?: number; Turret13Id?: number; Turret14Id?: number;
  Turret15Id?: number; Turret16Id?: number; Turret17Id?: number; Turret18Id?: number; Turret19Id?: number;
  Turret20Id?: number;
}, indexes: StaticIndexes) => {
  const ids = [
    option.Turret0Id, option.Turret1Id, option.Turret2Id, option.Turret3Id, option.Turret4Id,
    option.Turret5Id, option.Turret6Id, option.Turret7Id, option.Turret8Id, option.Turret9Id,
    option.Turret10Id, option.Turret11Id, option.Turret12Id, option.Turret13Id, option.Turret14Id,
    option.Turret15Id, option.Turret16Id, option.Turret17Id, option.Turret18Id, option.Turret19Id,
    option.Turret20Id,
  ].filter(isPositiveId);

  return ids
    .map(id => indexes.turretsById.get(id))
    .filter((turret): turret is NonNullable<typeof turret> => Boolean(turret));
};

/* ───────────────────────────────────────────────────────────────────
 * unitDetail resolver helpers — resolves a unit with option overrides
 * applied server-side (armor, mobility, sensors, abilities, turrets)
 * ─────────────────────────────────────────────────────────────────── */

const TURRET_FIELDS = [
  'Turret0Id', 'Turret1Id', 'Turret2Id', 'Turret3Id', 'Turret4Id',
  'Turret5Id', 'Turret6Id', 'Turret7Id', 'Turret8Id', 'Turret9Id',
  'Turret10Id', 'Turret11Id', 'Turret12Id', 'Turret13Id', 'Turret14Id',
  'Turret15Id', 'Turret16Id', 'Turret17Id', 'Turret18Id', 'Turret19Id',
  'Turret20Id',
] as const;

const buildUnitWeaponsWithOverrides = (
  resolvedUnitId: number,
  originalUnitId: number,
  activeOptions: Array<Record<string, unknown>>,
  indexes: StaticIndexes,
): UnitWeaponSlot[] => {
  // Channel-based turret resolution (mirrors legacy useUnitState):
  //   1. Base channel map from TurretUnits where Turret.IsDefault only
  //   2. Active options override channels via TurretXId fields
  //   3. Collect active turret IDs from channel map values
  //   4. Expand child turrets globally via ParentTurretId
  //   5. Resolve weapons from the active turret set

  // 1. Base channel map — only turrets with IsDefault populate channels
  const channelMap = new Map<number, number>();
  const allUnitTurrets = indexes.turretUnitsByUnitId.get(resolvedUnitId) ?? [];
  for (const tu of allUnitTurrets) {
    const turret = indexes.turretsById.get(tu.TurretId);
    if (turret && turret.IsDefault) {
      channelMap.set(tu.Order ?? 0, tu.TurretId);
    }
  }

  // 2. Apply active option overrides — TurretXId replaces channel X
  for (const opt of activeOptions) {
    for (let ch = 0; ch < TURRET_FIELDS.length; ch++) {
      const val = opt[TURRET_FIELDS[ch]] as number | undefined;
      if (isPositiveId(val)) {
        channelMap.set(ch, val);
      }
    }
  }

  // 3. Collect turret instances from channel values (preserve multiplicity!)
  //    The same turret ID on multiple channels = mirrored pylons, each producing
  //    a separate weapon entry (e.g., 4 channels with CBU x1 → 4 weapon entries).
  const channelTurretIds: number[] = [];
  const uniqueTurretIds = new Set<number>();
  for (const tid of channelMap.values()) {
    if (isPositiveId(tid)) {
      channelTurretIds.push(tid);
      uniqueTurretIds.add(tid);
    }
  }

  if (channelTurretIds.length === 0) {
    return [];
  }

  // 4. Global child expansion via ParentTurretId (recursive)
  //    Children are expanded once per unique parent, not per channel instance.
  const expandedChildIds = new Set<number>();
  const expandChildren = (parentId: number) => {
    const children = indexes.turretsByParentTurretId.get(parentId) ?? [];
    for (const child of children) {
      if (!expandedChildIds.has(child.Id) && !uniqueTurretIds.has(child.Id)) {
        expandedChildIds.add(child.Id);
        expandChildren(child.Id);
      }
    }
  };
  for (const tid of uniqueTurretIds) {
    expandChildren(tid);
  }

  // 5. Resolve weapons — one entry per channel occurrence (preserves pylon counts),
  //    plus one entry per expanded child turret.
  const results: UnitWeaponSlot[] = [];
  const ammoUnitId = originalUnitId;

  const resolveWeaponsForTurret = (tid: number) => {
    const turret = indexes.turretsById.get(tid);
    if (!turret) return;
    const turretWeapons = sortByOrder(
      indexes.turretWeaponsByTurretId.get(turret.Id) ?? [],
    );
    for (const tw of turretWeapons) {
      const weapon = indexes.weaponsById.get(tw.WeaponId);
      if (!weapon) continue;
      results.push({
        weapon,
        turret,
        ammunition: buildWeaponAmmoSlots(ammoUnitId, weapon.Id, indexes),
      });
    }
  };

  // Channel turrets — iterate ALL channel values (with duplicates)
  for (const tid of channelTurretIds) {
    resolveWeaponsForTurret(tid);
  }

  // Expanded children — once each
  for (const tid of expandedChildIds) {
    resolveWeaponsForTurret(tid);
  }

  return results;
};

const buildUnitDetailResult = (
  unitId: number,
  optionIds: number[] | null | undefined,
  ctx: GraphQLContext,
) => {
  const { data, indexes } = ctx;
  const baseUnit = indexes.unitsById.get(unitId);
  if (!baseUnit) return null;

  // 1. Modifications & selected options
  const modifications = sortByOrder(
    indexes.modificationsByUnitId.get(unitId) ?? [],
  );

  const modSlots = modifications.map(mod => {
    const options = sortByOrder(
      indexes.optionsByModificationId.get(mod.Id) ?? [],
    );
    const selected = optionIds?.length
      ? options.find(opt => optionIds.includes(opt.Id)) ?? null
      : null;
    const finalOption = selected ?? options.find(opt => opt.IsDefault) ?? options[0] ?? null;
    return {
      modification: mod,
      options,
      selectedOptionId: finalOption?.Id ?? 0,
      _opt: finalOption,
    };
  });

  const activeOptions = modSlots
    .map(s => s._opt)
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  // 2. Unit replacement, display name, cost
  let resolvedUnit = baseUnit;
  let displayName = baseUnit.HUDName ?? '';
  let totalCost = baseUnit.Cost ?? 0;

  for (const opt of activeOptions) {
    if (isPositiveId(opt.ReplaceUnitId)) {
      const replacement = indexes.unitsById.get(opt.ReplaceUnitId);
      if (replacement) {
        resolvedUnit = replacement;
        // If no explicit name override, inherit the replacement unit's name
        if (!opt.ReplaceUnitName && !opt.ConcatenateWithUnitName) {
          displayName = replacement.HUDName ?? displayName;
        }
      }
    }
    if (opt.ReplaceUnitName) displayName = opt.ReplaceUnitName;
    if (opt.ConcatenateWithUnitName) displayName = `${displayName} ${opt.ConcatenateWithUnitName}`;
    totalCost += opt.Cost ?? 0;
  }

  // 3. Armor (option override → base unit default)
  let armor = null;
  const armorOpt = activeOptions.find(o => isPositiveId(o.ArmorId));
  if (armorOpt) {
    armor = indexes.armorsById.get(armorOpt.ArmorId) ?? null;
  } else {
    const links = indexes.unitArmorsByUnitId.get(resolvedUnit.Id) ?? [];
    if (links.length) armor = indexes.armorsById.get(links[0].ArmorId) ?? null;
  }

  // 4. Mobility & fly preset
  let mobility = null;
  let flyPreset = null;
  const mobOpt = activeOptions.find(o => isPositiveId(o.MobilityId));
  if (mobOpt) {
    mobility = indexes.mobilityById.get(mobOpt.MobilityId) ?? null;
  } else {
    const links = indexes.unitPropulsionsByUnitId.get(resolvedUnit.Id) ?? [];
    if (links.length) mobility = indexes.mobilityById.get(links[0].MobilityId) ?? null;
  }
  if (mobility && isPositiveId(mobility.FlyPresetId)) {
    flyPreset = indexes.flyPresetsById.get(mobility.FlyPresetId) ?? null;
  }

  // 5. Sensors
  const sensors: unknown[] = [];
  const sMain = activeOptions.find(o => isPositiveId(o.MainSensorId));
  const sExtra = activeOptions.find(o => isPositiveId(o.ExtraSensorId));
  if (sMain) {
    const s = indexes.sensorsById.get(sMain.MainSensorId);
    if (s) sensors.push(s);
  } else {
    for (const link of indexes.sensorUnitsByUnitId.get(resolvedUnit.Id) ?? []) {
      const s = indexes.sensorsById.get(link.SensorId);
      if (s) sensors.push(s);
    }
  }
  if (sExtra) {
    const s = indexes.sensorsById.get(sExtra.ExtraSensorId);
    if (s && !sensors.some((e: any) => e.Id === s.Id)) sensors.push(s);
  }

  // 6. Abilities — start with base unit abilities, then merge option-specified abilities
  const abilityMap = new Map<number, unknown>();
  // Base unit abilities — only include IsDefault abilities; non-default ones come via Options
  for (const link of indexes.unitAbilitiesByUnitId.get(resolvedUnit.Id) ?? []) {
    const a = indexes.abilitiesById.get(link.AbilityId) as { Id: number; IsDefault?: boolean } | undefined;
    if (a && a.IsDefault !== false) abilityMap.set(link.AbilityId, a);
  }
  // Option abilities overlay (add / replace by Id)
  for (const opt of activeOptions) {
    for (const id of [opt.Ability1Id, opt.Ability2Id, opt.Ability3Id]) {
      if (isPositiveId(id)) {
        const a = indexes.abilitiesById.get(id);
        if (a) abilityMap.set(id, a);
      }
    }
  }
  const abilities = [...abilityMap.values()];

  // 7. Weapons (with turret overrides)
  let weapons = buildUnitWeaponsWithOverrides(
    resolvedUnit.Id,
    unitId,
    activeOptions as unknown as Array<Record<string, unknown>>,
    indexes,
  );

  // 7b. For infantry / squad units — build weapons from squad member weapon IDs
  //     when no turret-based weapons exist.
  if (weapons.length === 0) {
    const members = indexes.squadMembersByUnitId.get(resolvedUnit.Id) ?? [];
    if (members.length > 0) {
      const seenWeaponIds: number[] = [];
      for (const member of members) {
        for (const wid of [member.PrimaryWeaponId, member.SpecialWeaponId]) {
          if (isPositiveId(wid)) {
            seenWeaponIds.push(wid);
          }
        }
      }
      // Use resolvedUnit.Id for ammo lookups — when an option replaces the unit,
      // the weapon-ammunition entries are keyed under the replacement unit's ID.
      const ammoLookupUnitId = resolvedUnit.Id;
      for (const wid of seenWeaponIds) {
        const weapon = indexes.weaponsById.get(wid);
        if (!weapon) continue;
        weapons.push({
          weapon,
          turret: null,
          ammunition: buildWeaponAmmoSlots(ammoLookupUnitId, wid, indexes),
        });
      }
    }
  }

  // 8. Squad members
  const squadMembers = [...(indexes.squadMembersByUnitId.get(resolvedUnit.Id) ?? [])]
    .sort((a, b) => (a.DeathPriority ?? 0) - (b.DeathPriority ?? 0));

  // 9. Country
  const country = isPositiveId(baseUnit.CountryId)
    ? indexes.countriesById.get(baseUnit.CountryId) ?? null
    : null;

  // 10. Availability (specializations + transports)
  const specAvails = data.specializationAvailabilities.filter(sa => sa.UnitId === unitId);
  const availability = specAvails
    .map(sa => {
      const spec = indexes.specializationsById.get(sa.SpecializationId);
      if (!spec) return null;
      const transports = (indexes.transportAvailabilitiesBySpecAvailabilityId.get(sa.Id) ?? [])
        .map(ta => indexes.unitsById.get(ta.UnitId))
        .filter((u): u is NonNullable<typeof u> => Boolean(u));
      return {
        specialization: spec,
        maxAvailability: sa.MaxAvailabilityXp0,
        transports,
      };
    })
    .filter(Boolean);

  return {
    unit: resolvedUnit,
    baseUnit,
    displayName,
    totalCost,
    country,
    armor,
    mobility,
    flyPreset,
    sensors,
    abilities,
    weapons,
    modifications: modSlots.map(({ _opt, ...rest }) => rest),
    squadMembers,
    availability,
  };
};

// ── JSON scalar for deck data ──────────────────────────────────
const JSONScalar: GraphQLScalarType<unknown, unknown> = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast): unknown => {
    if (ast.kind === Kind.STRING) return JSON.parse(ast.value);
    if (ast.kind === Kind.INT) return parseInt(ast.value, 10);
    if (ast.kind === Kind.FLOAT) return parseFloat(ast.value);
    if (ast.kind === Kind.BOOLEAN) return ast.value;
    if (ast.kind === Kind.NULL) return null;
    if (ast.kind === Kind.OBJECT) {
      const obj: Record<string, unknown> = {};
      for (const field of ast.fields) {
        obj[field.name.value] = JSONScalar.parseLiteral(field.value, {});
      }
      return obj;
    }
    if (ast.kind === Kind.LIST) {
      return ast.values.map((v): unknown => JSONScalar.parseLiteral(v, {}));
    }
    return null;
  },
});

// GraphQL resolvers
// Cast needed: Mercurius expects MercuriusContext, but our context() function
// provides the extended GraphQLContext. The cast is safe because the context
// factory in index.ts always returns the full shape.
export const resolvers = {
  JSON: JSONScalar,
  Query: {
    units: (_: unknown, args: { filter?: Record<string, unknown>; offset?: number; limit?: number }, ctx: GraphQLContext) => {
      const filter = args.filter ?? {};
      const search = typeof filter.search === 'string' ? normalizeSearch(filter.search) : null;
      const { data } = ctx;
      let units = data.units;

      if (search) {
        units = units.filter(unit => (
          matchesSearch(unit.Name, search) ||
          matchesSearch(unit.HUDName, search) ||
          matchesSearch(unit.OriginalName, search) ||
          matchesSearch(unit.Description, search)
        ));
      }

      if (typeof filter.countryId === 'number') {
        units = units.filter(unit => unit.CountryId === filter.countryId);
      }

      if (typeof filter.type === 'number') {
        units = units.filter(unit => unit.Type === filter.type);
      }

      if (typeof filter.categoryType === 'number') {
        units = units.filter(unit => unit.CategoryType === filter.categoryType);
      }

      if (typeof filter.role === 'number') {
        units = units.filter(unit => unit.Role === filter.role);
      }

      if (typeof filter.displayInArmory === 'boolean') {
        units = units.filter(unit => unit.DisplayInArmory === filter.displayInArmory);
      }

      if (typeof filter.isUnitModification === 'boolean') {
        units = units.filter(unit => unit.IsUnitModification === filter.isUnitModification);
      }

      return withPagination(units, args.offset, args.limit);
    },
    unit: (_: unknown, args: { id: number }, ctx: GraphQLContext) => ctx.indexes.unitsById.get(args.id) ?? null,
    arsenalUnitsCards: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      return ctx.data.units
        .map(unit => buildArsenalUnitCard(unit.Id, ctx))
        .filter((card): card is ArsenalUnitCard => Boolean(card));
    },
    arsenalUnitCard: (_: unknown, args: { unitId: number }, ctx: GraphQLContext) =>
      buildArsenalUnitCard(args.unitId, ctx),
    countries: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.data.countries,

    // ── Search ──────────────────────────────────────────────────
    searchUnits: (_: unknown, args: { search: string; limit?: number }, ctx: GraphQLContext) => {
      const { data } = ctx;
      const search = normalizeSearch(args.search);
      if (!search) return [];
      const limit = Math.min(args.limit ?? 12, 30);
      const results: Array<{ Id: number; HUDName: string; ThumbnailFileName: string; CountryId: number; CategoryType: number; Cost: number }> = [];
      for (const unit of data.units) {
        if (!unit.DisplayInArmory) continue;
        if (
          matchesSearch(unit.Name, search) ||
          matchesSearch(unit.HUDName, search) ||
          matchesSearch(unit.OriginalName, search)
        ) {
          results.push({
            Id: unit.Id,
            HUDName: unit.HUDName,
            ThumbnailFileName: unit.ThumbnailFileName,
            CountryId: unit.CountryId,
            CategoryType: unit.CategoryType,
            Cost: unit.Cost,
          });
          if (results.length >= limit) break;
        }
      }
      return results;
    },

    weapons: (_: unknown, args: { search?: string; offset?: number; limit?: number }, ctx: GraphQLContext) => {
      const { data } = ctx;
      let weapons = data.weapons;
      if (args.search) {
        const search = normalizeSearch(args.search);
        weapons = weapons.filter(weapon => (
          matchesSearch(weapon.Name, search) ||
          matchesSearch(weapon.HUDName, search)
        ));
      }
      return withPagination(weapons, args.offset, args.limit);
    },
    weapon: (_: unknown, args: { id: number }, ctx: GraphQLContext) => ctx.indexes.weaponsById.get(args.id) ?? null,
    ammunitions: (_: unknown, args: { search?: string; offset?: number; limit?: number }, ctx: GraphQLContext) => {
      const { data } = ctx;
      let ammunitions = data.ammunitions;
      if (args.search) {
        const search = normalizeSearch(args.search);
        ammunitions = ammunitions.filter(ammo => (
          matchesSearch(ammo.Name, search) ||
          matchesSearch(ammo.HUDName, search)
        ));
      }
      return withPagination(ammunitions, args.offset, args.limit);
    },
    ammunition: (_: unknown, args: { id: number }, ctx: GraphQLContext) => ctx.indexes.ammunitionsById.get(args.id) ?? null,
    turrets: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.data.turrets,
    turret: (_: unknown, args: { id: number }, ctx: GraphQLContext) => ctx.indexes.turretsById.get(args.id) ?? null,
    abilities: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.data.abilities,
    armors: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.data.armors,
    mobility: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.data.mobility,
    sensors: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.data.sensors,
    modifications: (_: unknown, args: { unitId?: number }, ctx: GraphQLContext) => {
      const { data, indexes } = ctx;
      if (typeof args.unitId === 'number') {
        return indexes.modificationsByUnitId.get(args.unitId) ?? [];
      }
      return data.modifications;
    },
    options: (_: unknown, args: { modificationId?: number }, ctx: GraphQLContext) => {
      const { data, indexes } = ctx;
      if (typeof args.modificationId === 'number') {
        return indexes.optionsByModificationId.get(args.modificationId) ?? [];
      }
      return data.options;
    },
    specializations: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.data.specializations.filter(s => s.ShowInHangar),
    specialization: (_: unknown, args: { id: number }, ctx: GraphQLContext) =>
      ctx.indexes.specializationsById.get(args.id) ?? null,
    arsenalFilters: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const { data } = ctx;
      const units = data.units;
      return {
        countries: data.countries,
        types: uniqNumbers(units.map(unit => unit.Type)),
        categoryTypes: uniqNumbers(units.map(unit => unit.CategoryType)),
        roles: uniqNumbers(units.map(unit => unit.Role)),
      };
    },
    unitDetail: (_: unknown, args: { id: number; optionIds?: number[] }, ctx: GraphQLContext) =>
      buildUnitDetailResult(args.id, args.optionIds, ctx),
    builderData: (_: unknown, args: { countryId: number; spec1Id: number; spec2Id: number }, ctx: GraphQLContext) => {
      const { data } = ctx;

      // Countries — exclude hidden
      const countries = data.countries.filter(c => !c.Hidden);

      // Only specs flagged for the deck builder, filtered to visible countries.
      // Return all visible countries so the wizard can switch without re-fetching.
      const countryIds = new Set(countries.map(c => c.Id));
      const specializations = data.specializations.filter(
        s => s.ShowInHangar && countryIds.has(s.CountryId),
      );

      // Availabilities for both selected specs
      const specIds = new Set([args.spec1Id, args.spec2Id]);
      const availabilities = data.specializationAvailabilities
        .filter(sa => specIds.has(sa.SpecializationId))
        .map(sa => ({
          specAvailabilityId: sa.Id,
          specializationId: sa.SpecializationId,
          unitId: sa.UnitId,
          maxAvailabilityXp0: sa.MaxAvailabilityXp0,
          maxAvailabilityXp1: sa.MaxAvailabilityXp1,
          maxAvailabilityXp2: sa.MaxAvailabilityXp2,
          maxAvailabilityXp3: sa.MaxAvailabilityXp3,
        }));

      // Arsenal cards — reuse the existing builder
      const arsenalUnitsCards = data.units
        .map(unit => buildArsenalUnitCard(unit.Id, ctx))
        .filter((card): card is ArsenalUnitCard => Boolean(card));

      return { countries, specializations, arsenalUnitsCards, availabilities };
    },
    optionsByIds: (_: unknown, args: { ids: number[] }, ctx: GraphQLContext) => {
      const { indexes } = ctx;
      return args.ids
        .map(id => indexes.optionsById.get(id))
        .filter((opt): opt is NonNullable<typeof opt> => Boolean(opt));
    },

    // ── Deck publishing queries ─────────────────────────────
    publishedDeck: async (_: unknown, args: { id: string; viewerId?: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        const deck = await dbClient.getDeck(args.id);
        if (!deck) return null;
        // Database returns authorId; strip it and compute isOwner server-side
        const { authorId, ...rest } = deck;
        return { ...rest, isOwner: !!(args.viewerId && args.viewerId === authorId) };
      } catch {
        return null;
      }
    },

    browseDecks: async (_: unknown, args: { filter?: BrowseDecksFilter; viewerId?: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      const result = await dbClient.browseDecks(args.filter ?? {});
      const viewerId = args.viewerId;
      return {
        ...result,
        decks: result.decks.map((d) => {
          const { authorId, ...rest } = d;
          return { ...rest, isOwner: !!(viewerId && viewerId === authorId) };
        }),
      };
    },

    publishedDecksByAuthor: async (_: unknown, args: { authorId: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      const decks = await dbClient.getDecksByAuthor(args.authorId);
      // These are always the caller's own decks, so isOwner = true.
      // Strip authorId from the response.
      return decks.map((d) => {
        const { authorId, ...rest } = d;
        return { ...rest, isOwner: true };
      });
    },

    userProfile: async (_: unknown, args: { userId: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        return await dbClient.getUserProfile(args.userId);
      } catch {
        return null;
      }
    },

    challenge: async (_: unknown, _args: unknown, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      return dbClient.getChallenge();
    },

    deckLikeStatus: async (_: unknown, args: { deckId: string; userId: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      return dbClient.checkLikeStatus(args.deckId, args.userId);
    },

    // ── Analytics queries ────────────────────────────────
    analyticsMapRatings: async (_: unknown, _args: unknown, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        // Derive map play counts from teamsides (which has human-readable names)
        // instead of mapsrating (which has sv_play_map_* internal IDs)
        const teamsides = await dbClient.getMapTeamSides();
        if (!teamsides.data || teamsides.data.length === 0) {
          // Fallback to raw mapsrating if teamsides fails
          return await dbClient.getMapRatings();
        }
        return teamsides.data.map(entry => ({
          name: entry.map ?? null,
          count: (entry.winData ?? []).reduce((sum, w) => sum + (w.count ?? 0), 0),
        })).sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
      } catch {
        return [];
      }
    },

    analyticsMapTeamSides: async (_: unknown, _args: unknown, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        return await dbClient.getMapTeamSides();
      } catch {
        return { updateDate: null, data: [] };
      }
    },

    analyticsSpecUsage: async (_: unknown, _args: unknown, ctx: GraphQLContext) => {
      const { dbClient, indexes } = ctx;
      try {
        const raw = await dbClient.getSpecUsage();
        // Resolve numeric spec IDs to human-readable names
        return raw.map(item => {
          const specId = item.name ? parseInt(item.name, 10) : NaN;
          if (!Number.isNaN(specId)) {
            const spec = indexes.specializationsById.get(specId);
            if (spec) {
              return { ...item, name: spec.Name };
            }
          }
          return item;
        });
      } catch {
        return [];
      }
    },

    analyticsLeaderboard: async (_: unknown, args: { start?: number; end?: number }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      const start = args.start ?? 0;
      const end = args.end ?? 100;
      const cacheKey = `${start}:${end}`;

      // Return cached result if available
      const cached = leaderboardCache.get(cacheKey);
      if (cached && Date.now() < cached.expires) {
        return cached.data;
      }

      try {
        const entries = await dbClient.getLeaderboard(start, end);

        // Batch-resolve user IDs to get names, steamIds, marketIds
        const userIds = entries
          .map(e => e.userId)
          .filter((id): id is number => id != null);

        if (userIds.length > 0) {
          const users = await dbClient.getUsersByIds(userIds);
          for (const entry of entries) {
            if (entry.userId == null) continue;
            const user = users.get(entry.userId);
            if (!user) continue;
            if (!entry.name && user.name) entry.name = user.name;
            if (!entry.steamId && user.steamId) entry.steamId = user.steamId;
            if (entry.level == null && user.level != null) entry.level = user.level;
          }

          // Fetch player stats (KD, win rate) in batch for entries missing those fields
          const marketIdMap = new Map<string, StatsLeaderboardEntry[]>();
          for (const entry of entries) {
            // Skip entries that already have both KD and winRate from the leaderboard API
            if (entry.kdRatio != null && entry.winRate != null) continue;
            if (entry.userId == null) continue;
            const user = users.get(entry.userId);
            const marketId = user?.marketId ?? user?.steamId;
            if (!marketId) continue;
            if (!marketIdMap.has(marketId)) marketIdMap.set(marketId, []);
            marketIdMap.get(marketId)!.push(entry);
          }

          if (marketIdMap.size > 0) {
            try {
              const batchStats = await dbClient.getPlayerStatsBatch([...marketIdMap.keys()]);
              for (const [marketId, relatedEntries] of marketIdMap) {
                const stats = batchStats.get(marketId);
                if (!stats) continue;
                for (const entry of relatedEntries) {
                  if (stats.kdRatio != null) entry.kdRatio = stats.kdRatio;
                  if (stats.winsCount != null && stats.fightsCount != null && stats.fightsCount > 0) {
                    entry.winRate = stats.winsCount / stats.fightsCount;
                  }
                }
              }
            } catch { /* non-critical — leaderboard still shows without KD/winRate */ }
          }
        }

        // Cache the fully-resolved result
        leaderboardCache.set(cacheKey, { data: entries, expires: Date.now() + LEADERBOARD_CACHE_TTL });

        return entries;
      } catch {
        return [];
      }
    },

    analyticsPlayer: async (_: unknown, args: { marketId: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        return await dbClient.getPlayerStats(args.marketId);
      } catch {
        return null;
      }
    },

    analyticsCountryStats: async (_: unknown, _args: unknown, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        return await dbClient.getCountryStats();
      } catch {
        return { updateDate: null, matchesCount: [], winsCount: [] };
      }
    },

    analyticsUserLookup: async (_: unknown, args: { steamId: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        return await dbClient.getUserById(args.steamId, { steam: true });
      } catch {
        return null;
      }
    },

    analyticsUserProfile: async (_: unknown, args: { steamId: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        // Resolve Steam ID → internal user info
        const user = await dbClient.getUserById(args.steamId, { steam: true });
        if (!user) return null;

        // Fetch player stats using marketId (which equals steamId for Steam users)
        const marketId = user.marketId ?? user.steamId ?? args.steamId;
        const stats = await dbClient.getPlayerStats(marketId);

        // Fetch recent fight IDs
        const recentFightIds = await dbClient.getRecentFightIds(user.id);

        return {
          user,
          stats,
          recentFightIds: recentFightIds.slice(0, 50),
        };
      } catch {
        return null;
      }
    },

    analyticsRecentFights: async (_: unknown, args: { steamId: string }, ctx: GraphQLContext) => {
      const { dbClient, indexes, data } = ctx;
      const emptyResult = {
        fights: [], frequentTeammates: [], frequentOpponents: [],
        mostUsedUnits: [], topKillerUnits: [], topDamageUnits: [],
        topDamageReceivedUnits: [], factionBreakdown: [], specUsage: [], specCombos: [],
      };

      // ── Shared aggregation types ─────────────────────────────
      type UnitAgg = {
        unitId: number;
        optionIds: number[];
        count: number;
        totalKills: number;
        totalDamageDealt: number;
        totalDamageReceived: number;
        countryId: number | null;
      };

      const resolveUnitPerf = (agg: UnitAgg) => {
        const unitData = indexes.unitsById.get(agg.unitId);
        const optionNames = agg.optionIds
          .map((oid) => {
            const opt = indexes.optionsById.get(oid);
            if (!opt) return null;
            return opt.UIName || opt.Name || null;
          })
          .filter((n): n is string => n != null);
        return {
          unitId: agg.unitId,
          unitName: unitData?.HUDName ?? unitData?.Name ?? null,
          optionIds: agg.optionIds,
          optionNames,
          configKey: `${agg.unitId}:${agg.optionIds.join(',')}`,
          count: agg.count,
          totalKills: Math.round(agg.totalKills),
          totalDamageDealt: Math.round(agg.totalDamageDealt),
          totalDamageReceived: Math.round(agg.totalDamageReceived),
          avgKills: agg.count > 0 ? Math.round((agg.totalKills / agg.count) * 100) / 100 : 0,
          avgDamage: agg.count > 0 ? Math.round((agg.totalDamageDealt / agg.count) * 100) / 100 : 0,
          avgDamageReceived: agg.count > 0 ? Math.round((agg.totalDamageReceived / agg.count) * 100) / 100 : 0,
          countryId: agg.countryId,
          countryName: agg.countryId != null ? (indexes.countriesById?.get(agg.countryId)?.Name ?? null) : null,
        };
      };

      const buildUnitRankings = (unitMap: Map<string, UnitAgg>) => {
        // Return ALL units sorted by each metric — no slice here.
        // Frontend applies faction filter THEN slices to top-N.
        const allUnits = [...unitMap.values()];
        return {
          mostUsedUnits: [...allUnits].sort((a, b) => b.count - a.count).map(resolveUnitPerf),
          topKillerUnits: [...allUnits].sort((a, b) => b.totalKills - a.totalKills).map(resolveUnitPerf),
          topDamageUnits: [...allUnits].sort((a, b) => b.totalDamageDealt - a.totalDamageDealt).map(resolveUnitPerf),
          topDamageReceivedUnits: [...allUnits].sort((a, b) => b.totalDamageReceived - a.totalDamageReceived).map(resolveUnitPerf),
        };
      };

      try {
        // Resolve Steam ID → internal user (lightweight, always needed)
        const user = await dbClient.getUserById(args.steamId, { steam: true });
        if (!user) return emptyResult;

        // ── S3 fight data (with in-memory TTL cache) ───────────
        const fightIds = await dbClient.getRecentFightIds(user.id);
        const targetIds = fightIds.slice(0, 100); // fight cache absorbs repeat fetches
        if (targetIds.length === 0) return emptyResult;

        // Track teammate/opponent frequency
        const teammateMap = new Map<number, { name: string; count: number; wins: number; losses: number }>();
        const opponentMap = new Map<number, { name: string; count: number; wins: number; losses: number }>();
        const unitMap = new Map<string, UnitAgg>();
        const factionCounts = new Map<string, number>();
        const specCounts = new Map<number, number>();
        const specComboCounts = new Map<string, { specIds: number[]; count: number }>();

        // Build reverse index: unitId -> Set<specId> for spec inference
        const unitIdToSpecIds = new Map<number, Set<number>>();
        for (const sa of data.specializationAvailabilities) {
          let set = unitIdToSpecIds.get(sa.UnitId);
          if (!set) { set = new Set(); unitIdToSpecIds.set(sa.UnitId, set); }
          set.add(sa.SpecializationId);
        }

        // Fetch S3 fight data with concurrency control (5 at a time, reduced for fallback)
        const CONCURRENCY = 5;
        const results: (Record<string, unknown> | null)[] = new Array(targetIds.length).fill(null);

        for (let i = 0; i < targetIds.length; i += CONCURRENCY) {
          const batch = targetIds.slice(i, i + CONCURRENCY);
          const batchResults = await Promise.all(
            batch.map(async (fightId) => {
              try {
                const fight = await dbClient.getFightData(fightId);
                if (!fight) return null;

                const player = fight.players.find(
                  (p) => p.steamId === args.steamId || String(p.id) === String(user.id),
                );

                let ratingChange: number | null = null;
                if (player?.oldRating != null && player?.newRating != null) {
                  ratingChange = player.newRating - player.oldRating;
                }

                let result: string | null = null;
                const playerTeam = player?.teamId;
                if (fight.winnerTeam != null && playerTeam != null) {
                  result = playerTeam === fight.winnerTeam ? 'win' : 'loss';
                } else if (ratingChange != null && ratingChange !== 0) {
                  result = ratingChange > 0 ? 'win' : 'loss';
                }

                const isRanked = ratingChange != null && ratingChange !== 0;
                const allyRatings: number[] = [];
                const enemyRatings: number[] = [];
                if (player?.oldRating != null) allyRatings.push(player.oldRating);

                // Use teamId from S3 data to reliably identify allies vs enemies.
                // Falls back to rating-change inference only if teamId is missing.
                const playerTeamKnown = playerTeam != null;

                if (fight.players.length > 2) {
                  for (const other of fight.players) {
                    if (other.id === player?.id) continue;

                    // Determine if same team: prefer teamId, fallback to rating direction
                    let isSameTeam: boolean | null = null;
                    if (playerTeamKnown && other.teamId != null) {
                      isSameTeam = other.teamId === playerTeam;
                    } else if (isRanked) {
                      const otherChange = other.oldRating != null && other.newRating != null
                        ? other.newRating - other.oldRating : null;
                      if (otherChange != null && otherChange !== 0) {
                        isSameTeam = (ratingChange! > 0) === (otherChange > 0);
                      }
                    }
                    if (isSameTeam == null) continue;

                    if (other.oldRating != null) {
                      (isSameTeam ? allyRatings : enemyRatings).push(other.oldRating);
                    }

                    // Track teammates/opponents for the frequent-players panel
                    if (isRanked) {
                      const map = isSameTeam ? teammateMap : opponentMap;
                      const existing = map.get(other.id);
                      if (existing) {
                        existing.count++;
                        if (result === 'win') existing.wins++;
                        else if (result === 'loss') existing.losses++;
                      } else {
                        map.set(other.id, {
                          name: other.name ?? `Player ${other.id}`,
                          count: 1,
                          wins: result === 'win' ? 1 : 0,
                          losses: result === 'loss' ? 1 : 0,
                        });
                      }
                    }
                  }
                }

                const allyAvgRating = allyRatings.length > 0
                  ? Math.round(allyRatings.reduce((s, r) => s + r, 0) / allyRatings.length) : null;
                const enemyAvgRating = enemyRatings.length > 0
                  ? Math.round(enemyRatings.reduce((s, r) => s + r, 0) / enemyRatings.length) : null;

                let fightCountryName: string | null = null;
                let fightCountryFlag: string | null = null;
                let fightSpecNames: string[] = [];
                let fightSpecIcons: string[] = [];

                if (isRanked && player) {
                  const countryCounts = new Map<number, number>();
                  for (const unit of player.units) {
                    const unitData = indexes.unitsById.get(unit.id);
                    if (unitData?.CountryId) {
                      countryCounts.set(unitData.CountryId, (countryCounts.get(unitData.CountryId) ?? 0) + 1);
                    }
                    const sorted = [...unit.optionIds].sort((a, b) => a - b);
                    const key = `${unit.id}:${sorted.join(',')}`;
                    const existing = unitMap.get(key);
                    if (existing) {
                      existing.count++;
                      existing.totalKills += unit.killedCount ?? 0;
                      existing.totalDamageDealt += unit.totalDamageDealt ?? 0;
                      existing.totalDamageReceived += unit.totalDamageReceived ?? 0;
                    } else {
                      unitMap.set(key, {
                        unitId: unit.id, optionIds: sorted, count: 1,
                        totalKills: unit.killedCount ?? 0,
                        totalDamageDealt: unit.totalDamageDealt ?? 0,
                        totalDamageReceived: unit.totalDamageReceived ?? 0,
                        countryId: unitData?.CountryId ?? null,
                      });
                    }
                  }

                  if (countryCounts.size > 0) {
                    const topCountryId = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
                    const country = indexes.countriesById?.get(topCountryId);
                    const factionName = country?.Name ?? `Faction ${topCountryId}`;
                    factionCounts.set(factionName, (factionCounts.get(factionName) ?? 0) + 1);
                    fightCountryName = factionName;
                    fightCountryFlag = country?.FlagFileName ?? null;
                  }

                  const specScores = new Map<number, number>();
                  for (const unit of player.units) {
                    const specs = unitIdToSpecIds.get(unit.id);
                    if (specs) {
                      for (const specId of specs) {
                        specScores.set(specId, (specScores.get(specId) ?? 0) + 1);
                      }
                    }
                  }
                  const topSpecs = [...specScores.entries()]
                    .sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => id);
                  for (const specId of topSpecs) {
                    specCounts.set(specId, (specCounts.get(specId) ?? 0) + 1);
                  }
                  fightSpecNames = topSpecs.map((id) => {
                    const spec = indexes.specializationsById.get(id);
                    return spec?.Name || spec?.UIName || `Spec ${id}`;
                  });
                  fightSpecIcons = topSpecs.map((id) => {
                    const spec = indexes.specializationsById.get(id);
                    return spec?.Icon || '';
                  });
                  if (topSpecs.length === 2) {
                    const comboKey = topSpecs.sort((a, b) => a - b).join(':');
                    const ex = specComboCounts.get(comboKey);
                    if (ex) ex.count++;
                    else specComboCounts.set(comboKey, { specIds: [...topSpecs], count: 1 });
                  }
                }

                const pc = fight.players.length;
                const teamSize = pc >= 2 ? `${Math.ceil(pc / 2)}v${Math.floor(pc / 2)}` : `${pc}`;

                return {
                  fightId, mapId: fight.mapId, mapName: resolveMapName(fight.mapId),
                  totalPlayTimeSec: fight.totalPlayTimeSec, endTime: fight.endTime,
                  victoryLevel: fight.victoryLevel, playerCount: pc, teamSize,
                  result, ratingChange, winnerTeam: fight.winnerTeam,
                  destruction: player?.destruction ?? null, losses: player?.losses ?? null,
                  damageDealt: player?.damageDealt ?? null, damageReceived: player?.damageReceived ?? null,
                  allyAvgRating, enemyAvgRating,
                  objectivesCaptured: player?.objectivesCaptured ?? null,
                  oldRating: player?.oldRating ?? null,
                  countryName: fightCountryName, countryFlag: fightCountryFlag,
                  specNames: fightSpecNames, specIcons: fightSpecIcons,
                };
              } catch {
                return null;
              }
            }),
          );
          for (let j = 0; j < batchResults.length; j++) {
            results[i + j] = batchResults[j] as Record<string, unknown> | null;
          }
        }

        // Build sorted frequent player lists (top 10) and resolve Steam IDs
        const toSortedList = (map: Map<number, { name: string; count: number; wins: number; losses: number }>) =>
          [...map.entries()]
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([id, v]) => ({ odId: id, name: v.name, steamId: null as string | null, count: v.count, wins: v.wins, losses: v.losses }));

        const teammates = toSortedList(teammateMap);
        const opponents = toSortedList(opponentMap);

        const allIds = [...teammates, ...opponents].map((p) => p.odId).filter(Boolean);
        if (allIds.length > 0) {
          try {
            const userMap = await dbClient.getUsersByIds(allIds);
            for (const p of [...teammates, ...opponents]) {
              const resolved = userMap.get(p.odId);
              if (resolved?.steamId) p.steamId = resolved.steamId;
            }
          } catch { /* non-critical */ }
        }

        const { mostUsedUnits, topKillerUnits, topDamageUnits, topDamageReceivedUnits } = buildUnitRankings(unitMap);

        const factionBreakdown = [...factionCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count }));

        const specUsage = [...specCounts.entries()]
          .sort((a, b) => b[1] - a[1]).slice(0, 10)
          .map(([specId, count]) => {
            const spec = indexes.specializationsById.get(specId);
            return { specId, name: spec?.Name || spec?.UIName || `Spec ${specId}`, count };
          });

        const specCombos = [...specComboCounts.values()]
          .sort((a, b) => b.count - a.count).slice(0, 10)
          .map((combo) => ({
            specIds: combo.specIds,
            names: combo.specIds.map((id) => {
              const spec = indexes.specializationsById.get(id);
              return spec?.Name || spec?.UIName || `Spec ${id}`;
            }),
            count: combo.count,
          }));

        return {
          fights: results.filter(Boolean),
          frequentTeammates: teammates, frequentOpponents: opponents,
          mostUsedUnits, topKillerUnits, topDamageUnits, topDamageReceivedUnits,
          factionBreakdown, specUsage, specCombos,
        };
      } catch {
        return emptyResult;
      }
    },

    analyticsFightData: async (_: unknown, args: { fightId: string }, ctx: GraphQLContext) => {
      const { dbClient, indexes, data } = ctx;
      try {
        const fight = await dbClient.getFightData(args.fightId);
        if (!fight) return null;

        // Batch-resolve player internal IDs → Steam IDs for profile linking
        const playerIds = fight.players.map((p) => p.id).filter(Boolean);
        let userMap = new Map<number, { steamId?: string }>();
        if (playerIds.length > 0) {
          try {
            userMap = await dbClient.getUsersByIds(playerIds);
          } catch { /* Non-critical */ }
        }

        // Build reverse index for spec inference: unitId → Set<specId>
        const unitIdToSpecIds = new Map<number, Set<number>>();
        for (const sa of data.specializationAvailabilities) {
          let set = unitIdToSpecIds.get(sa.UnitId);
          if (!set) { set = new Set(); unitIdToSpecIds.set(sa.UnitId, set); }
          set.add(sa.SpecializationId);
        }

        // Enrich players
        const enrichedPlayers = fight.players.map(player => {
          const resolved = userMap.get(player.id);

          // Infer country + flag from majority of deployed units
          const countryCounts = new Map<number, number>();
          const specScores = new Map<number, number>();
          for (const unit of player.units) {
            const ud = indexes.unitsById.get(unit.id);
            if (ud?.CountryId) countryCounts.set(ud.CountryId, (countryCounts.get(ud.CountryId) ?? 0) + 1);
            // Spec inference
            const specs = unitIdToSpecIds.get(unit.id);
            if (specs) {
              for (const specId of specs) specScores.set(specId, (specScores.get(specId) ?? 0) + 1);
            }
          }

          let countryId: number | null = null;
          let countryName: string | null = null;
          let countryFlag: string | null = null;
          if (countryCounts.size > 0) {
            countryId = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
            const country = indexes.countriesById?.get(countryId);
            countryName = country?.Name ?? null;
            countryFlag = country?.FlagFileName ?? null;
          }

          // Top 2 specs
          const topSpecs = [...specScores.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([id]) => id);
          const specNames: string[] = [];
          const specIcons: string[] = [];
          for (const specId of topSpecs) {
            const spec = indexes.specializationsById.get(specId);
            if (spec) {
              specNames.push(spec.Name || spec.UIName);
              specIcons.push(spec.Icon || '');
            }
          }

          return {
            ...player,
            steamId: resolved?.steamId ?? player.steamId ?? null,
            countryId,
            countryName,
            countryFlag,
            specNames,
            specIcons,
            badges: [] as string[], // populated below
            units: player.units.map(unit => {
              const unitData = indexes.unitsById.get(unit.id);
              const baseCost = unitData?.Cost ?? 0;
              let optionCost = 0;
              const optionNames: string[] = [];
              const modList: { modId: number; optId: number; cost: number; run: string | null; cwun: string | null }[] = [];
              for (const oid of unit.optionIds) {
                const opt = indexes.optionsById.get(oid);
                if (opt) {
                  optionCost += opt.Cost ?? 0;
                  modList.push({
                    modId: opt.ModificationId,
                    optId: opt.Id,
                    cost: opt.Cost ?? 0,
                    run: opt.ReplaceUnitName || null,
                    cwun: opt.ConcatenateWithUnitName || null,
                  });
                  // Return raw UIName — frontend resolves via game locale system
                  const raw = opt.UIName || opt.Name || null;
                  if (raw) optionNames.push(raw);
                }
              }
              return {
                ...unit,
                unitName: unitData?.HUDName ?? unitData?.Name ?? null,
                unitType: unitData?.Type ?? null,
                categoryType: unitData?.CategoryType ?? null,
                thumbnailFileName: unitData?.ThumbnailFileName ?? null,
                portraitFileName: unitData?.PortraitFileName ?? null,
                optionNames,
                totalCost: baseCost + optionCost,
                modList,
              };
            }),
            };
          });

        // Compute performance badges
        if (enrichedPlayers.length > 0) {
          // MVP — highest positive rating change
          const withRating = enrichedPlayers
            .filter((p) => p.oldRating != null && p.newRating != null)
            .map((p) => ({ p, delta: (p.newRating ?? 0) - (p.oldRating ?? 0) }))
            .filter((x) => x.delta > 0)
            .sort((a, b) => b.delta - a.delta);
          if (withRating.length > 0) withRating[0].p.badges.push('MVP');

          // Top Fragger — most kills
          const maxKills = Math.max(...enrichedPlayers.map((p) => p.destruction ?? 0));
          if (maxKills > 0) {
            enrichedPlayers.filter((p) => (p.destruction ?? 0) === maxKills).forEach((p) => p.badges.push('Top Fragger'));
          }

          // Objective Hero — most objectives
          const maxObj = Math.max(...enrichedPlayers.map((p) => p.objectivesCaptured ?? 0));
          if (maxObj > 0) {
            enrichedPlayers.filter((p) => (p.objectivesCaptured ?? 0) === maxObj).forEach((p) => p.badges.push('Objective Hero'));
          }

          // Supply Master — most supply consumed
          const maxSupply = Math.max(...enrichedPlayers.map((p) => p.supplyPointsConsumed ?? 0));
          if (maxSupply > 0) {
            enrichedPlayers.filter((p) => (p.supplyPointsConsumed ?? 0) === maxSupply).forEach((p) => p.badges.push('Supply Master'));
          }

          // Damage Dealer — most damage dealt
          const maxDmg = Math.max(...enrichedPlayers.map((p) => p.damageDealt ?? 0));
          if (maxDmg > 0) {
            enrichedPlayers.filter((p) => (p.damageDealt ?? 0) === maxDmg).forEach((p) => p.badges.push('Damage Dealer'));
          }
        }

        return {
          ...fight,
          mapName: resolveMapName(fight.mapId),
          players: enrichedPlayers,
        };
      } catch {
        return null;
      }
    },

    // ── Snapshot / history queries ────────────────────────────

    snapshotLeaderboardHistory: async (
      _: unknown,
      args: { steamId: string; since?: string },
      ctx: GraphQLContext,
    ) => {
      const { dbClient } = ctx;
      try {
        return await dbClient.getLeaderboardHistory(args.steamId, args.since);
      } catch {
        return [];
      }
    },

    // ── Rolling aggregation queries (from raw match data) ────

    rollingFactionStats: async (_: unknown, args: { since?: string; eloBracket?: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        return await dbClient.getRollingFactionStats(args.since, args.eloBracket);
      } catch {
        return { rows: [], since: '' };
      }
    },

    rollingMapStats: async (_: unknown, args: { since?: string; eloBracket?: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        return await dbClient.getRollingMapStats(args.since, args.eloBracket);
      } catch {
        return { rows: [], since: '' };
      }
    },

    rollingSpecStats: async (_: unknown, args: { since?: string; eloBracket?: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        return await dbClient.getRollingSpecStats(args.since, args.eloBracket);
      } catch {
        return { rows: [], since: '' };
      }
    },

    unitPerformance: async (
      _: unknown,
      args: { since?: string; eloBracket?: string; faction?: string; limit?: number },
      ctx: GraphQLContext,
    ) => {
      const { dbClient, indexes } = ctx;
      try {
        const result = await dbClient.getUnitPerformanceRolling(
          args.since, args.eloBracket, args.faction, args.limit,
        );
        // Resolve option IDs to display names
        return result.rows.map((row: any) => {
          if (row.optionIds && typeof row.optionIds === 'string') {
            const ids = row.optionIds.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n));
            const names = ids
              .map((id: number) => {
                const opt = indexes.optionsById.get(id);
                return opt?.UIName || opt?.Name || null;
              })
              .filter((n: string | null): n is string => n != null);
            return { ...row, optionNames: names };
          }
          return { ...row, optionNames: [] };
        });
      } catch {
        return [];
      }
    },

    specCombos: async (
      _: unknown,
      args: { since?: string; limit?: number },
      ctx: GraphQLContext,
    ) => {
      const { dbClient } = ctx;
      try {
        const result = await dbClient.getSpecCombos(args.since, args.limit);
        return result.rows;
      } catch {
        return [];
      }
    },

    crawlerStatus: async (_: unknown, _args: unknown, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        return await dbClient.getCrawlerState();
      } catch {
        return null;
      }
    },
  },
  Mutation: {
    ping: () => 'pong',

    registerUser: async (_: unknown, args: { tentativeId: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      return dbClient.registerUser({ tentativeId: args.tentativeId });
    },

    publishDeck: async (_: unknown, args: { input: PublishDeckInput }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      const deck = await dbClient.publishDeck(args.input);
      const { authorId, ...rest } = deck;
      return { ...rest, isOwner: true };
    },

    updatePublishedDeck: async (
      _: unknown,
      args: { deckId: string; input: UpdatePublishedDeckInput & { authorId: string } },
      ctx: GraphQLContext,
    ) => {
      const { dbClient } = ctx;
      const deck = await dbClient.updateDeck(args.deckId, args.input);
      const { authorId, ...rest } = deck;
      return { ...rest, isOwner: true };
    },

    deletePublishedDeck: async (
      _: unknown,
      args: { deckId: string; input: DeletePublishedDeckInput },
      ctx: GraphQLContext,
    ) => {
      const { dbClient } = ctx;
      await dbClient.deleteDeck(args.deckId, args.input);
      return true;
    },

    toggleDeckLike: async (_: unknown, args: { deckId: string; userId: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      return dbClient.toggleLike(args.deckId, args.userId);
    },

    recordDeckView: async (_: unknown, args: { deckId: string; viewerKey?: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      return dbClient.recordView(args.deckId, args.viewerKey);
    },
  },
  Subscription: {
    messageAdded: {
      subscribe: async function* () {
        while (true) {
          yield { messageAdded: `Update at ${new Date().toISOString()}` };
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      },
    },
  },
  Unit: {
    country: (unit: { CountryId?: number }, _: unknown, ctx: GraphQLContext) => {
      const { indexes } = ctx;
      return isPositiveId(unit.CountryId) ? indexes.countriesById.get(unit.CountryId) ?? null : null;
    },
    abilities: (unit: { Id: number }, _: unknown, ctx: GraphQLContext) => {
      const { indexes } = ctx;
      const links = indexes.unitAbilitiesByUnitId.get(unit.Id) ?? [];
      return links
        .map(link => indexes.abilitiesById.get(link.AbilityId))
        .filter((ability): ability is NonNullable<typeof ability> => Boolean(ability));
    },
    armors: (unit: { Id: number }, _: unknown, ctx: GraphQLContext) => {
      const { indexes } = ctx;
      const links = indexes.unitArmorsByUnitId.get(unit.Id) ?? [];
      return links
        .map(link => indexes.armorsById.get(link.ArmorId))
        .filter((armor): armor is NonNullable<typeof armor> => Boolean(armor));
    },
    mobility: (unit: { Id: number }, _: unknown, ctx: GraphQLContext) => {
      const { indexes } = ctx;
      const links = indexes.unitPropulsionsByUnitId.get(unit.Id) ?? [];
      return links
        .map(link => indexes.mobilityById.get(link.MobilityId))
        .filter((mobility): mobility is NonNullable<typeof mobility> => Boolean(mobility));
    },
    sensors: (unit: { Id: number }, _: unknown, ctx: GraphQLContext) => {
      const { indexes } = ctx;
      const links = indexes.sensorUnitsByUnitId.get(unit.Id) ?? [];
      return links
        .map(link => indexes.sensorsById.get(link.SensorId))
        .filter((sensor): sensor is NonNullable<typeof sensor> => Boolean(sensor));
    },
    turrets: (unit: { Id: number }, _: unknown, ctx: GraphQLContext) => {
      const { indexes } = ctx;
      const links = sortByOrder(indexes.turretUnitsByUnitId.get(unit.Id) ?? []);
      return links
        .map(link => indexes.turretsById.get(link.TurretId))
        .filter((turret): turret is NonNullable<typeof turret> => Boolean(turret));
    },
    weapons: (unit: { Id: number }, _: unknown, ctx: GraphQLContext) =>
      buildUnitWeapons(unit.Id, ctx.indexes),
    modifications: (unit: { Id: number }, _: unknown, ctx: GraphQLContext) =>
      sortByOrder(ctx.indexes.modificationsByUnitId.get(unit.Id) ?? []),
    squadMembers: (unit: { Id: number }, _: unknown, ctx: GraphQLContext) =>
      [...(ctx.indexes.squadMembersByUnitId.get(unit.Id) ?? [])].sort(
        (a, b) => (a.DeathPriority ?? 0) - (b.DeathPriority ?? 0),
      ),
    squadWeapons: (unit: { Id: number }, _: unknown, ctx: GraphQLContext) => {
      const { indexes } = ctx;
      const links = indexes.squadWeaponsByUnitId.get(unit.Id) ?? [];
      return links
        .map(link => indexes.weaponsById.get(link.WeaponId))
        .filter((weapon): weapon is NonNullable<typeof weapon> => Boolean(weapon));
    },
  },
  Mobility: {
    flyPreset: (mobility: { FlyPresetId?: number }, _: unknown, ctx: GraphQLContext) =>
      isPositiveId(mobility.FlyPresetId)
        ? ctx.indexes.flyPresetsById.get(mobility.FlyPresetId) ?? null
        : null,
  },
  Modification: {
    unit: (mod: { UnitId: number }, _: unknown, ctx: GraphQLContext) =>
      ctx.indexes.unitsById.get(mod.UnitId) ?? null,
    options: (mod: { Id: number }, _: unknown, ctx: GraphQLContext) =>
      sortByOrder(ctx.indexes.optionsByModificationId.get(mod.Id) ?? []),
  },
  Option: {
    armor: (option: { ArmorId?: number }, _: unknown, ctx: GraphQLContext) =>
      isPositiveId(option.ArmorId) ? ctx.indexes.armorsById.get(option.ArmorId) ?? null : null,
    mobility: (option: { MobilityId?: number }, _: unknown, ctx: GraphQLContext) =>
      isPositiveId(option.MobilityId) ? ctx.indexes.mobilityById.get(option.MobilityId) ?? null : null,
    mainSensor: (option: { MainSensorId?: number }, _: unknown, ctx: GraphQLContext) =>
      isPositiveId(option.MainSensorId) ? ctx.indexes.sensorsById.get(option.MainSensorId) ?? null : null,
    extraSensor: (option: { ExtraSensorId?: number }, _: unknown, ctx: GraphQLContext) =>
      isPositiveId(option.ExtraSensorId) ? ctx.indexes.sensorsById.get(option.ExtraSensorId) ?? null : null,
    abilities: (option: { Ability1Id?: number; Ability2Id?: number; Ability3Id?: number }, _: unknown, ctx: GraphQLContext) => {
      const { indexes } = ctx;
      const ids = [option.Ability1Id, option.Ability2Id, option.Ability3Id].filter(isPositiveId);
      return ids
        .map(id => indexes.abilitiesById.get(id))
        .filter((ability): ability is NonNullable<typeof ability> => Boolean(ability));
    },
    turrets: (option: Record<string, number>, _: unknown, ctx: GraphQLContext) =>
      resolveOptionTurrets(option, ctx.indexes),
    replaceUnit: (option: { ReplaceUnitId?: number }, _: unknown, ctx: GraphQLContext) =>
      isPositiveId(option.ReplaceUnitId)
        ? ctx.indexes.unitsById.get(option.ReplaceUnitId) ?? null
        : null,
  },
  Specialization: {
    country: (spec: { CountryId?: number }, _: unknown, ctx: GraphQLContext) =>
      isPositiveId(spec.CountryId)
        ? ctx.indexes.countriesById.get(spec.CountryId) ?? null
        : null,
    availabilities: (spec: { Id: number }, _: unknown, ctx: GraphQLContext) =>
      ctx.indexes.specializationAvailabilitiesBySpecializationId.get(spec.Id) ?? [],
  },
  SpecializationAvailability: {
    unit: (availability: { UnitId: number }, _: unknown, ctx: GraphQLContext) =>
      ctx.indexes.unitsById.get(availability.UnitId) ?? null,
    transports: (availability: { Id: number }, _: unknown, ctx: GraphQLContext) =>
      ctx.indexes.transportAvailabilitiesBySpecAvailabilityId.get(availability.Id) ?? [],
  },
  TransportAvailability: {
    unit: (transport: { UnitId: number }, _: unknown, ctx: GraphQLContext) =>
      ctx.indexes.unitsById.get(transport.UnitId) ?? null,
    specializationAvailability: (transport: { SpecializationAvailabilityId: number }, _: unknown, ctx: GraphQLContext) =>
      ctx.indexes.specializationAvailabilitiesById.get(transport.SpecializationAvailabilityId) ?? null,
  },
  SquadMember: {
    primaryWeapon: (member: { PrimaryWeaponId?: number }, _: unknown, ctx: GraphQLContext) =>
      isPositiveId(member.PrimaryWeaponId)
        ? ctx.indexes.weaponsById.get(member.PrimaryWeaponId) ?? null
        : null,
    specialWeapon: (member: { SpecialWeaponId?: number }, _: unknown, ctx: GraphQLContext) =>
      isPositiveId(member.SpecialWeaponId)
        ? ctx.indexes.weaponsById.get(member.SpecialWeaponId) ?? null
        : null,
  },
  Turret: {
    turretWeapons: (turret: { Id: number }, _: unknown, ctx: GraphQLContext) =>
      sortByOrder(ctx.indexes.turretWeaponsByTurretId.get(turret.Id) ?? []),
  },
  TurretWeapon: {
    weapon: (tw: { WeaponId: number }, _: unknown, ctx: GraphQLContext) =>
      ctx.indexes.weaponsById.get(tw.WeaponId) ?? null,
    turret: (tw: { TurretId: number }, _: unknown, ctx: GraphQLContext) =>
      ctx.indexes.turretsById.get(tw.TurretId) ?? null,
  },
} as unknown as IResolvers;
