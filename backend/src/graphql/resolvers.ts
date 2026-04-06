import type { MercuriusContext, IResolvers } from 'mercurius';
import { GraphQLScalarType, Kind } from 'graphql';
import type { StaticData } from '../data/loader.js';
import type { StaticIndexes } from '../data/indexes.js';
import type { DatabaseClient, PlayerMatchHistoryResult, PlayerMatchTeamRow, PlayerMatchUnitRow, PlayerMatchOtherPlayer } from '../services/databaseClient.js';
import type { StatsClient } from '../services/statsClient.js';
import type { SteamProfileClient } from '../services/steamProfileClient.js';
import type {
  BrowseDecksFilter,
  PublishDeckInput,
  UpdatePublishedDeckInput,
  DeletePublishedDeckInput,
} from '@ba-hub/shared';
import { resolveMapName } from '../data/constants.js';

type GraphQLContext = MercuriusContext & {
  data: StaticData;
  indexes: StaticIndexes;
  dbClient: DatabaseClient;
  statsClient: StatsClient;
  steamProfileClient: SteamProfileClient;
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
      const { statsClient } = ctx;
      try {
        // Derive map play counts from teamsides (which has human-readable names)
        // instead of mapsrating (which has sv_play_map_* internal IDs)
        const teamsides = await statsClient.getMapTeamSides();
        if (!teamsides.data || teamsides.data.length === 0) {
          // Fallback to raw mapsrating if teamsides fails
          return await statsClient.getMapRatings();
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
      const { statsClient } = ctx;
      try {
        return await statsClient.getMapTeamSides();
      } catch {
        return { updateDate: null, data: [] };
      }
    },

    analyticsSpecUsage: async (_: unknown, _args: unknown, ctx: GraphQLContext) => {
      const { statsClient, indexes } = ctx;
      try {
        const raw = await statsClient.getSpecUsage();
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
      const { statsClient } = ctx;
      try {
        const start = args.start ?? 0;
        const end = args.end ?? 100;
        const entries = await statsClient.getLeaderboard(start, end);

        // Batch-resolve user IDs to get names, steamIds, marketIds (cheap: /user?ids= batches of 20 in parallel)
        const userIds = entries
          .map(e => e.userId)
          .filter((id): id is number => id != null);

        if (userIds.length > 0) {
          const users = await statsClient.getUsersByIds(userIds);
          for (const entry of entries) {
            if (entry.userId == null) continue;
            const user = users.get(entry.userId);
            if (!user) continue;
            if (!entry.name && user.name) entry.name = user.name;
            if (!entry.steamId && user.steamId) entry.steamId = user.steamId;
            if (entry.level == null && user.level != null) entry.level = user.level;
          }

          // Per-entry getPlayerStats (for kdRatio / winRate) is one HTTP call per player and does
          // not scale past ~100 entries without rate-limiting. Only run it for small ranges.
          const range = entries.length;
          if (range > 0 && range <= 100) {
            const statsPromises = entries.map(async (entry) => {
              if (entry.userId == null) return;
              const user = users.get(entry.userId);
              const marketId = user?.marketId ?? user?.steamId;
              if (!marketId) return;
              try {
                const stats = await statsClient.getPlayerStats(marketId);
                if (!stats) return;
                if (stats.kdRatio != null) entry.kdRatio = stats.kdRatio;
                if (stats.winsCount != null && stats.fightsCount != null && stats.fightsCount > 0) {
                  entry.winRate = stats.winsCount / stats.fightsCount;
                }
              } catch { /* non-critical */ }
            });
            await Promise.all(statsPromises);
          }
        }

        return entries;
      } catch {
        return [];
      }
    },

    analyticsPlayer: async (_: unknown, args: { marketId: string }, ctx: GraphQLContext) => {
      const { statsClient } = ctx;
      try {
        return await statsClient.getPlayerStats(args.marketId);
      } catch {
        return null;
      }
    },

    analyticsCountryStats: async (_: unknown, _args: unknown, ctx: GraphQLContext) => {
      const { statsClient } = ctx;
      try {
        return await statsClient.getCountryStats();
      } catch {
        return { updateDate: null, matchesCount: [], winsCount: [] };
      }
    },

    analyticsUserLookup: async (_: unknown, args: { steamId: string }, ctx: GraphQLContext) => {
      const { statsClient } = ctx;
      try {
        return await statsClient.getUserById(args.steamId, { steam: true });
      } catch {
        return null;
      }
    },

    analyticsUserProfile: async (_: unknown, args: { steamId: string }, ctx: GraphQLContext) => {
      const { statsClient } = ctx;
      try {
        // Resolve Steam ID → internal user info
        const user = await statsClient.getUserById(args.steamId, { steam: true });
        if (!user) return null;

        // Fetch player stats using marketId (which equals steamId for Steam users)
        const marketId = user.marketId ?? user.steamId ?? args.steamId;
        const stats = await statsClient.getPlayerStats(marketId);

        // Fetch recent fight IDs
        const recentFightIds = await statsClient.getRecentFightIds(user.id);

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
      const { statsClient, dbClient, indexes, data } = ctx;
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
        const allUnits = [...unitMap.values()];

        // Country names we expose faction filters for. Top-10 lists are
        // returned as the UNION of the global top 10 + the top 10 within
        // each of these faction buckets, so the frontend can filter to
        // any single faction and still see a true top 10 (not just the
        // intersection of "global top 10" ∩ "this faction").
        const FILTERABLE_FACTIONS = ['USA', 'Russia'];

        const topNUnion = (cmp: (a: UnitAgg, b: UnitAgg) => number, n: number) => {
          const sortedAll = [...allUnits].sort(cmp);
          const buckets: UnitAgg[][] = [sortedAll.slice(0, n)];
          for (const factionName of FILTERABLE_FACTIONS) {
            const country = [...indexes.countriesById?.values() ?? []]
              .find((c) => c.Name === factionName);
            if (!country) continue;
            buckets.push(
              sortedAll.filter((u) => u.countryId === country.Id).slice(0, n),
            );
          }
          // Dedupe by configKey (unitId + sorted optionIds)
          const seen = new Set<string>();
          const merged: UnitAgg[] = [];
          for (const bucket of buckets) {
            for (const u of bucket) {
              const k = `${u.unitId}:${u.optionIds.join(',')}`;
              if (seen.has(k)) continue;
              seen.add(k);
              merged.push(u);
            }
          }
          // Re-sort the merged set so the "All" view stays correctly ordered
          return merged.sort(cmp).map(resolveUnitPerf);
        };

        return {
          mostUsedUnits: topNUnion((a, b) => b.count - a.count, 10),
          topKillerUnits: topNUnion((a, b) => b.totalKills - a.totalKills, 10),
          topDamageUnits: topNUnion((a, b) => b.totalDamageDealt - a.totalDamageDealt, 10),
          topDamageReceivedUnits: topNUnion((a, b) => b.totalDamageReceived - a.totalDamageReceived, 10),
        };
      };

      try {
        // Resolve Steam ID → internal user (lightweight, always needed)
        const user = await statsClient.getUserById(args.steamId, { steam: true });
        if (!user) return emptyResult;

        // ── Try DB-first path (fast, no S3 calls) ─────────────
        let dbResult: PlayerMatchHistoryResult | null = null;
        try {
          dbResult = await dbClient.getPlayerMatchHistory(args.steamId, user.id, 100);
        } catch {
          // DB unavailable — fall through to external API path
        }

        if (dbResult && dbResult.matches.length > 0) {
          return buildFromDbData(dbResult, user.id, args.steamId, indexes, statsClient);
        }

        // ── Fallback: limited S3 fetch (20 fights max) ────────
        const fightIds = await statsClient.getRecentFightIds(user.id);
        const targetIds = fightIds.slice(0, 20); // Reduced from 100 to avoid hammering S3
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
                const fight = await statsClient.getFightData(fightId);
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

                // ── Multi-detector ranked check ─────────────────
                // Layer multiple signals so a single missing field doesn't
                // misclassify a ranked match. Any one signal qualifies.
                const detRanked_eloMoved = ratingChange != null && ratingChange !== 0;
                const detRanked_hasRatings =
                  player?.oldRating != null && player?.newRating != null;
                const detRanked_otherEloMoved = fight.players.some(
                  (p) =>
                    p.id !== player?.id &&
                    p.oldRating != null &&
                    p.newRating != null &&
                    p.newRating !== p.oldRating,
                );
                const detRanked_anyOtherHasRatings = fight.players.some(
                  (p) => p.id !== player?.id && p.oldRating != null && p.newRating != null,
                );
                const isRanked =
                  detRanked_eloMoved ||
                  detRanked_hasRatings ||
                  detRanked_otherEloMoved ||
                  detRanked_anyOtherHasRatings;

                // ── Team average ratings via teamId ─────────────
                // Use the authoritative teamId on each player record. Works
                // for any player count (including 1v1) and doesn't drop
                // players whose own ELO didn't move. Recovers MM data the
                // old rating-direction-inference path was silently dropping.
                const allyRatings: number[] = [];
                const enemyRatings: number[] = [];
                if (player?.oldRating != null) allyRatings.push(player.oldRating);
                if (player?.teamId != null) {
                  for (const other of fight.players) {
                    if (other.id === player.id) continue;
                    if (other.oldRating == null) continue;
                    if (other.teamId === player.teamId) allyRatings.push(other.oldRating);
                    else if (other.teamId != null) enemyRatings.push(other.oldRating);
                  }
                }

                // ── Teammate / opponent frequency tracking ──────
                if (isRanked && player?.teamId != null) {
                  for (const other of fight.players) {
                    if (other.id === player.id) continue;
                    if (other.teamId == null) continue;
                    const isSameTeam = other.teamId === player.teamId;
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
                  specNames: fightSpecNames,
                  specIcons: fightSpecIcons,
                  isRanked,
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
            const userMap = await statsClient.getUsersByIds(allIds);
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

      // ── DB-backed player match history builder ───────────────
      async function buildFromDbData(
        dbData: PlayerMatchHistoryResult,
        _userId: number,
        _steamId: string,
        idx: StaticIndexes,
        sc: StatsClient,
      ) {
        const { matches, teams, units, otherPlayers } = dbData;

        // Index teams and units by fightId for fast lookup
        const teamsByFight = new Map<number, PlayerMatchTeamRow[]>();
        for (const t of teams) {
          let arr = teamsByFight.get(t.fightId);
          if (!arr) { arr = []; teamsByFight.set(t.fightId, arr); }
          arr.push(t);
        }

        const unitsByFight = new Map<number, PlayerMatchUnitRow[]>();
        for (const u of units) {
          let arr = unitsByFight.get(u.fightId);
          if (!arr) { arr = []; unitsByFight.set(u.fightId, arr); }
          arr.push(u);
        }

        const othersByFight = new Map<number, PlayerMatchOtherPlayer[]>();
        for (const o of otherPlayers) {
          let arr = othersByFight.get(o.fightId);
          if (!arr) { arr = []; othersByFight.set(o.fightId, arr); }
          arr.push(o);
        }

        // Aggregation maps
        const teammateMap = new Map<number, { name: string; count: number; wins: number; losses: number }>();
        const opponentMap = new Map<number, { name: string; count: number; wins: number; losses: number }>();
        type UnitAggLocal = {
          unitId: number; optionIds: number[]; count: number;
          totalKills: number; totalDamageDealt: number; totalDamageReceived: number;
          countryId: number | null;
        };
        const unitMap = new Map<string, UnitAggLocal>();
        const factionCounts = new Map<string, number>();
        const specCounts = new Map<number, number>();
        const specComboCounts = new Map<string, { specIds: number[]; count: number }>();

        // Build fight results
        const fights = matches.map((m) => {
          const fightTeams = teamsByFight.get(m.fightId) ?? [];
          const fightUnits = unitsByFight.get(m.fightId) ?? [];
          const fightOthers = othersByFight.get(m.fightId) ?? [];

          // Win/loss detection
          const ratingChange = m.oldRating != null && m.newRating != null
            ? m.newRating - m.oldRating : null;
          let result: string | null = null;
          if (m.winnerTeam != null && m.playerTeamId != null) {
            result = m.playerTeamId === m.winnerTeam ? 'win' : 'loss';
          } else if (ratingChange != null && ratingChange !== 0) {
            result = ratingChange > 0 ? 'win' : 'loss';
          }

          // ── Multi-detector ranked check ──────────────────────
          // The DB query already filters to is_ranked = true, but we layer
          // multiple signals so the resolver is resilient to upstream drift
          // and so the frontend can trust isRanked even if any single signal
          // is missing.
          const detRanked_dbFlag = m.isRanked === true;
          const detRanked_eloMoved = ratingChange != null && ratingChange !== 0;
          const detRanked_hasRatings = m.oldRating != null && m.newRating != null;
          const detRanked_otherEloMoved = fightOthers.some(
            (o) => o.oldRating != null && o.newRating != null && o.newRating !== o.oldRating,
          );
          const isRanked =
            detRanked_dbFlag ||
            detRanked_eloMoved ||
            detRanked_hasRatings ||
            detRanked_otherEloMoved;

          // ── Player team-id inference ────────────────────────
          // The crawler currently doesn't always populate
          // match_player_picks.team_id, which silently breaks team-side
          // attribution. Recover it from the win/loss + match_team_results.is_winner.
          let inferredPlayerTeamId: number | null = m.playerTeamId;
          if (inferredPlayerTeamId == null && result != null && fightTeams.length > 0) {
            const wantsWinner = result === 'win';
            const matched = fightTeams.find((t) => t.isWinner === wantsWinner);
            if (matched) inferredPlayerTeamId = matched.teamId;
          }
          if (inferredPlayerTeamId == null && m.winnerTeam != null && result === 'win') {
            inferredPlayerTeamId = m.winnerTeam;
          }

          // ── Team average ratings ────────────────────────────
          // 1) Prefer the precomputed match_team_results.avg_rating
          // 2) Fall back to averaging individual oldRating values from
          //    match_player_picks (other players + the player themselves)
          //    grouped by team_id. This recovers many "ranked but no MM"
          //    rows where the precomputed avg was null because the crawler
          //    saw zero rated players on a team at insert time.
          const allyTeam = inferredPlayerTeamId != null
            ? fightTeams.find((t) => t.teamId === inferredPlayerTeamId)
            : undefined;
          const enemyTeam = inferredPlayerTeamId != null
            ? fightTeams.find((t) => t.teamId !== inferredPlayerTeamId)
            : undefined;
          let allyAvgRating: number | null = allyTeam?.avgRating != null ? Math.round(allyTeam.avgRating) : null;
          let enemyAvgRating: number | null = enemyTeam?.avgRating != null ? Math.round(enemyTeam.avgRating) : null;

          if ((allyAvgRating == null || enemyAvgRating == null) && inferredPlayerTeamId != null) {
            const allyRatings: number[] = [];
            const enemyRatings: number[] = [];
            if (m.oldRating != null) allyRatings.push(m.oldRating);
            for (const o of fightOthers) {
              if (o.oldRating == null) continue;
              if (o.teamId === inferredPlayerTeamId) allyRatings.push(o.oldRating);
              else if (o.teamId != null) enemyRatings.push(o.oldRating);
            }
            if (allyAvgRating == null && allyRatings.length > 0) {
              allyAvgRating = Math.round(allyRatings.reduce((s, r) => s + r, 0) / allyRatings.length);
            }
            if (enemyAvgRating == null && enemyRatings.length > 0) {
              enemyAvgRating = Math.round(enemyRatings.reduce((s, r) => s + r, 0) / enemyRatings.length);
            }
          }

          // Teammate/opponent tracking from other players in this fight
          if (isRanked && inferredPlayerTeamId != null) {
            for (const other of fightOthers) {
              if (other.odId == null) continue;
              const isSameTeam = other.teamId === inferredPlayerTeamId;
              const map = isSameTeam ? teammateMap : opponentMap;
              const existing = map.get(other.odId);
              if (existing) {
                existing.count++;
                if (result === 'win') existing.wins++;
                else if (result === 'loss') existing.losses++;
              } else {
                map.set(other.odId, {
                  name: other.steamId ?? `Player ${other.odId}`,
                  count: 1,
                  wins: result === 'win' ? 1 : 0,
                  losses: result === 'loss' ? 1 : 0,
                });
              }
            }
          }

          // Aggregate unit performance
          let fightCountryName: string | null = null;
          let fightCountryFlag: string | null = null;
          if (isRanked) {
            const countryCounts = new Map<number, number>();
            for (const u of fightUnits) {
              const unitData = idx.unitsById.get(u.unitId);
              if (unitData?.CountryId) {
                countryCounts.set(unitData.CountryId, (countryCounts.get(unitData.CountryId) ?? 0) + 1);
              }
              const optIds = u.optionIds ? u.optionIds.split(',').map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b) : [];
              const key = `${u.unitId}:${optIds.join(',')}`;
              const existing = unitMap.get(key);
              if (existing) {
                existing.count++;
                existing.totalKills += u.killedCount ?? 0;
                existing.totalDamageDealt += u.totalDamageDealt ?? 0;
                existing.totalDamageReceived += u.totalDamageReceived ?? 0;
              } else {
                unitMap.set(key, {
                  unitId: u.unitId, optionIds: optIds, count: 1,
                  totalKills: u.killedCount ?? 0,
                  totalDamageDealt: u.totalDamageDealt ?? 0,
                  totalDamageReceived: u.totalDamageReceived ?? 0,
                  countryId: unitData?.CountryId ?? null,
                });
              }
            }

            if (countryCounts.size > 0) {
              const topCountryId = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
              const country = idx.countriesById?.get(topCountryId);
              const fn = country?.Name ?? `Faction ${topCountryId}`;
              factionCounts.set(fn, (factionCounts.get(fn) ?? 0) + 1);
              fightCountryName = fn;
              fightCountryFlag = country?.FlagFileName ?? null;
            }
          }

          // Faction from player pick
          if (m.playerFaction && !fightCountryName) {
            factionCounts.set(m.playerFaction, (factionCounts.get(m.playerFaction) ?? 0) + 1);
            fightCountryName = m.playerFaction;
          }

          // Spec tracking from DB-stored spec names/IDs
          const fightSpecNames: string[] = [];
          const fightSpecIcons: string[] = [];
          const specIds: number[] = [];
          if (m.spec1Id != null) { specIds.push(m.spec1Id); specCounts.set(m.spec1Id, (specCounts.get(m.spec1Id) ?? 0) + 1); }
          if (m.spec2Id != null) { specIds.push(m.spec2Id); specCounts.set(m.spec2Id, (specCounts.get(m.spec2Id) ?? 0) + 1); }
          if (m.spec1Name) fightSpecNames.push(m.spec1Name);
          if (m.spec2Name) fightSpecNames.push(m.spec2Name);
          for (const sid of specIds) {
            const spec = idx.specializationsById.get(sid);
            fightSpecIcons.push(spec?.Icon || '');
          }
          if (specIds.length === 2) {
            const comboKey = [...specIds].sort((a, b) => a - b).join(':');
            const ex = specComboCounts.get(comboKey);
            if (ex) ex.count++;
            else specComboCounts.set(comboKey, { specIds: [...specIds].sort((a, b) => a - b), count: 1 });
          }

          const teamSize = m.playerCount >= 2
            ? `${Math.ceil(m.playerCount / 2)}v${Math.floor(m.playerCount / 2)}`
            : `${m.playerCount}`;

          return {
            fightId: m.fightId,
            mapId: m.mapId,
            mapName: m.mapName ?? resolveMapName(m.mapId ?? undefined),
            totalPlayTimeSec: m.totalPlayTimeSec,
            endTime: m.endTime,
            victoryLevel: null, // Not stored in DB — minor stat
            playerCount: m.playerCount,
            teamSize,
            result,
            ratingChange,
            winnerTeam: m.winnerTeam,
            destruction: m.destruction,
            losses: m.playerLosses,
            damageDealt: m.damageDealt,
            damageReceived: m.damageReceived,
            allyAvgRating,
            enemyAvgRating,
            objectivesCaptured: m.objectivesCaptured,
            oldRating: m.oldRating,
            countryName: fightCountryName,
            countryFlag: fightCountryFlag,
            specNames: fightSpecNames,
            specIcons: fightSpecIcons,
            isRanked: Boolean(isRanked),
          };
        });

        // Build sorted frequent player lists (top 10) and resolve Steam IDs
        const toSortedList = (map: Map<number, { name: string; count: number; wins: number; losses: number }>) =>
          [...map.entries()]
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([id, v]) => ({ odId: id, name: v.name, steamId: null as string | null, count: v.count, wins: v.wins, losses: v.losses }));

        const teammates = toSortedList(teammateMap);
        const opponents = toSortedList(opponentMap);

        // Batch-resolve internal IDs → Steam IDs for profile linking
        const allIds = [...teammates, ...opponents].map((p) => p.odId).filter(Boolean);
        if (allIds.length > 0) {
          try {
            const userMap = await sc.getUsersByIds(allIds);
            for (const p of [...teammates, ...opponents]) {
              const resolved = userMap.get(p.odId);
              if (resolved?.steamId) p.steamId = resolved.steamId;
              if (resolved?.name) p.name = resolved.name;
            }
          } catch { /* non-critical */ }
        }

        const unitRankings = buildUnitRankings(unitMap as Map<string, UnitAgg>);

        const factionBreakdown = [...factionCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count }));

        const specUsage = [...specCounts.entries()]
          .sort((a, b) => b[1] - a[1]).slice(0, 10)
          .map(([specId, count]) => {
            const spec = idx.specializationsById.get(specId);
            return { specId, name: spec?.Name || spec?.UIName || `Spec ${specId}`, count };
          });

        const specCombos = [...specComboCounts.values()]
          .sort((a, b) => b.count - a.count).slice(0, 10)
          .map((combo) => ({
            specIds: combo.specIds,
            names: combo.specIds.map((id) => {
              const spec = idx.specializationsById.get(id);
              return spec?.Name || spec?.UIName || `Spec ${id}`;
            }),
            count: combo.count,
          }));

        return {
          fights,
          frequentTeammates: teammates,
          frequentOpponents: opponents,
          ...unitRankings,
          factionBreakdown,
          specUsage,
          specCombos,
        };
      }
    },

    analyticsFightData: async (_: unknown, args: { fightId: string }, ctx: GraphQLContext) => {
      const { statsClient, indexes, data } = ctx;
      try {
        const fight = await statsClient.getFightData(args.fightId);
        if (!fight) return null;

        // Batch-resolve player internal IDs → Steam IDs for profile linking
        const playerIds = fight.players.map((p) => p.id).filter(Boolean);
        let userMap = new Map<number, { steamId?: string }>();
        if (playerIds.length > 0) {
          try {
            userMap = await statsClient.getUsersByIds(playerIds);
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

    // ── Steam profile enrichment ──────────────────────────────

    steamProfiles: async (
      _: unknown,
      args: { steamIds: string[] },
      ctx: GraphQLContext,
    ) => {
      const ids = Array.isArray(args.steamIds) ? args.steamIds : [];
      if (ids.length === 0) return [];
      if (ids.length > 200) {
        throw new Error('Too many steamIds (max 200)');
      }
      const deduped = Array.from(new Set(ids));
      const resolved = await ctx.steamProfileClient.getProfiles(deduped);
      return deduped.map((id) => resolved.get(id) ?? {
        steamId: id,
        personaName: null,
        avatarIcon: null,
        avatarMedium: null,
        avatarFull: null,
        profileUrl: null,
      });
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

    snapshotMapHistory: async (_: unknown, args: { since?: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        return await dbClient.getMapHistory(args.since);
      } catch {
        return [];
      }
    },

    snapshotFactionHistory: async (_: unknown, args: { since?: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        return await dbClient.getFactionHistory(args.since);
      } catch {
        return [];
      }
    },

    snapshotUnitRankings: async (_: unknown, args: { limit?: number }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        return await dbClient.getUnitRankings(args.limit);
      } catch {
        return { snapshotDate: null, units: [] };
      }
    },

    // ── Crawler-derived snapshot queries ─────────────────────

    crawlerFactionHistory: async (_: unknown, args: { since?: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        return await dbClient.getCrawlerFactionHistory(args.since);
      } catch {
        return [];
      }
    },

    snapshotSpecHistory: async (_: unknown, args: { since?: string }, ctx: GraphQLContext) => {
      const { dbClient } = ctx;
      try {
        return await dbClient.getSpecHistory(args.since);
      } catch {
        return [];
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
