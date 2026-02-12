import type { MercuriusContext } from 'mercurius';
import type { StaticData } from '../data/loader.js';
import type { StaticIndexes } from '../data/indexes.js';

type GraphQLContext = MercuriusContext & {
  data: StaticData;
  indexes: StaticIndexes;
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
    .filter((entry): entry is { ammunition: unknown; order: number; quantity: number } => Boolean(entry));
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
    if (turret && (turret as any).IsDefault) {
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
  let displayName = baseUnit.Name ?? '';
  let totalCost = baseUnit.Cost ?? 0;

  for (const opt of activeOptions) {
    if (isPositiveId(opt.ReplaceUnitId)) {
      const replacement = indexes.unitsById.get(opt.ReplaceUnitId);
      if (replacement) resolvedUnit = replacement;
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
  if (mobility && isPositiveId((mobility as any).FlyPresetId)) {
    flyPreset = indexes.flyPresetsById.get((mobility as any).FlyPresetId) ?? null;
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
      // Produce one weapon entry per squad-member weapon reference (dupes included)
      // so that the frontend merge logic can aggregate them properly.
      for (const wid of seenWeaponIds) {
        const weapon = indexes.weaponsById.get(wid);
        if (!weapon) continue;
        weapons.push({
          weapon,
          turret: null,
          ammunition: buildWeaponAmmoSlots(unitId, wid, indexes),
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

// GraphQL resolvers
export const resolvers = {
  Query: {
    units: (_: unknown, args: { filter?: Record<string, unknown>; offset?: number; limit?: number }, ctx: any) => {
      const filter = args.filter ?? {};
      const search = typeof filter.search === 'string' ? normalizeSearch(filter.search) : null;
      const { data } = ctx as GraphQLContext;
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
    unit: (_: unknown, args: { id: number }, ctx: any) => (ctx as GraphQLContext).indexes.unitsById.get(args.id) ?? null,
    arsenalUnitsCards: (_: unknown, __: unknown, ctx: any) => {
      const typedCtx = ctx as GraphQLContext;
      return typedCtx.data.units
        .map(unit => buildArsenalUnitCard(unit.Id, typedCtx))
        .filter((card): card is ArsenalUnitCard => Boolean(card));
    },
    arsenalUnitCard: (_: unknown, args: { unitId: number }, ctx: any) =>
      buildArsenalUnitCard(args.unitId, ctx as GraphQLContext),
    countries: (_: unknown, __: unknown, ctx: any) => (ctx as GraphQLContext).data.countries,
    weapons: (_: unknown, args: { search?: string; offset?: number; limit?: number }, ctx: any) => {
      const { data } = ctx as GraphQLContext;
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
    weapon: (_: unknown, args: { id: number }, ctx: any) => (ctx as GraphQLContext).indexes.weaponsById.get(args.id) ?? null,
    ammunitions: (_: unknown, args: { search?: string; offset?: number; limit?: number }, ctx: any) => {
      const { data } = ctx as GraphQLContext;
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
    ammunition: (_: unknown, args: { id: number }, ctx: any) => (ctx as GraphQLContext).indexes.ammunitionsById.get(args.id) ?? null,
    turrets: (_: unknown, __: unknown, ctx: any) => (ctx as GraphQLContext).data.turrets,
    turret: (_: unknown, args: { id: number }, ctx: any) => (ctx as GraphQLContext).indexes.turretsById.get(args.id) ?? null,
    abilities: (_: unknown, __: unknown, ctx: any) => (ctx as GraphQLContext).data.abilities,
    armors: (_: unknown, __: unknown, ctx: any) => (ctx as GraphQLContext).data.armors,
    mobility: (_: unknown, __: unknown, ctx: any) => (ctx as GraphQLContext).data.mobility,
    sensors: (_: unknown, __: unknown, ctx: any) => (ctx as GraphQLContext).data.sensors,
    modifications: (_: unknown, args: { unitId?: number }, ctx: any) => {
      const { data, indexes } = ctx as GraphQLContext;
      if (typeof args.unitId === 'number') {
        return indexes.modificationsByUnitId.get(args.unitId) ?? [];
      }
      return data.modifications;
    },
    options: (_: unknown, args: { modificationId?: number }, ctx: any) => {
      const { data, indexes } = ctx as GraphQLContext;
      if (typeof args.modificationId === 'number') {
        return indexes.optionsByModificationId.get(args.modificationId) ?? [];
      }
      return data.options;
    },
    specializations: (_: unknown, __: unknown, ctx: any) => (ctx as GraphQLContext).data.specializations,
    specialization: (_: unknown, args: { id: number }, ctx: any) =>
      (ctx as GraphQLContext).indexes.specializationsById.get(args.id) ?? null,
    arsenalFilters: (_: unknown, __: unknown, ctx: any) => {
      const { data } = ctx as GraphQLContext;
      const units = data.units;
      return {
        countries: data.countries,
        types: uniqNumbers(units.map(unit => unit.Type)),
        categoryTypes: uniqNumbers(units.map(unit => unit.CategoryType)),
        roles: uniqNumbers(units.map(unit => unit.Role)),
      };
    },
    unitDetail: (_: unknown, args: { id: number; optionIds?: number[] }, ctx: any) =>
      buildUnitDetailResult(args.id, args.optionIds, ctx as GraphQLContext),
  },
  Mutation: {
    ping: () => 'pong',
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
    country: (unit: { CountryId?: number }, _: unknown, ctx: any) => {
      const { indexes } = ctx as GraphQLContext;
      return isPositiveId(unit.CountryId) ? indexes.countriesById.get(unit.CountryId) ?? null : null;
    },
    abilities: (unit: { Id: number }, _: unknown, ctx: any) => {
      const { indexes } = ctx as GraphQLContext;
      const links = indexes.unitAbilitiesByUnitId.get(unit.Id) ?? [];
      return links
        .map(link => indexes.abilitiesById.get(link.AbilityId))
        .filter((ability): ability is NonNullable<typeof ability> => Boolean(ability));
    },
    armors: (unit: { Id: number }, _: unknown, ctx: any) => {
      const { indexes } = ctx as GraphQLContext;
      const links = indexes.unitArmorsByUnitId.get(unit.Id) ?? [];
      return links
        .map(link => indexes.armorsById.get(link.ArmorId))
        .filter((armor): armor is NonNullable<typeof armor> => Boolean(armor));
    },
    mobility: (unit: { Id: number }, _: unknown, ctx: any) => {
      const { indexes } = ctx as GraphQLContext;
      const links = indexes.unitPropulsionsByUnitId.get(unit.Id) ?? [];
      return links
        .map(link => indexes.mobilityById.get(link.MobilityId))
        .filter((mobility): mobility is NonNullable<typeof mobility> => Boolean(mobility));
    },
    sensors: (unit: { Id: number }, _: unknown, ctx: any) => {
      const { indexes } = ctx as GraphQLContext;
      const links = indexes.sensorUnitsByUnitId.get(unit.Id) ?? [];
      return links
        .map(link => indexes.sensorsById.get(link.SensorId))
        .filter((sensor): sensor is NonNullable<typeof sensor> => Boolean(sensor));
    },
    turrets: (unit: { Id: number }, _: unknown, ctx: any) => {
      const { indexes } = ctx as GraphQLContext;
      const links = sortByOrder(indexes.turretUnitsByUnitId.get(unit.Id) ?? []);
      return links
        .map(link => indexes.turretsById.get(link.TurretId))
        .filter((turret): turret is NonNullable<typeof turret> => Boolean(turret));
    },
    weapons: (unit: { Id: number }, _: unknown, ctx: any) =>
      buildUnitWeapons(unit.Id, (ctx as GraphQLContext).indexes),
    modifications: (unit: { Id: number }, _: unknown, ctx: any) =>
      sortByOrder((ctx as GraphQLContext).indexes.modificationsByUnitId.get(unit.Id) ?? []),
    squadMembers: (unit: { Id: number }, _: unknown, ctx: any) =>
      [...((ctx as GraphQLContext).indexes.squadMembersByUnitId.get(unit.Id) ?? [])].sort(
        (a, b) => (a.DeathPriority ?? 0) - (b.DeathPriority ?? 0),
      ),
    squadWeapons: (unit: { Id: number }, _: unknown, ctx: any) => {
      const { indexes } = ctx as GraphQLContext;
      const links = indexes.squadWeaponsByUnitId.get(unit.Id) ?? [];
      return links
        .map(link => indexes.weaponsById.get(link.WeaponId))
        .filter((weapon): weapon is NonNullable<typeof weapon> => Boolean(weapon));
    },
  },
  Mobility: {
    flyPreset: (mobility: { FlyPresetId?: number }, _: unknown, ctx: any) =>
      isPositiveId(mobility.FlyPresetId)
        ? (ctx as GraphQLContext).indexes.flyPresetsById.get(mobility.FlyPresetId) ?? null
        : null,
  },
  Modification: {
    unit: (mod: { UnitId: number }, _: unknown, ctx: any) =>
      (ctx as GraphQLContext).indexes.unitsById.get(mod.UnitId) ?? null,
    options: (mod: { Id: number }, _: unknown, ctx: any) =>
      sortByOrder((ctx as GraphQLContext).indexes.optionsByModificationId.get(mod.Id) ?? []),
  },
  Option: {
    armor: (option: { ArmorId?: number }, _: unknown, ctx: any) =>
      isPositiveId(option.ArmorId) ? (ctx as GraphQLContext).indexes.armorsById.get(option.ArmorId) ?? null : null,
    mobility: (option: { MobilityId?: number }, _: unknown, ctx: any) =>
      isPositiveId(option.MobilityId) ? (ctx as GraphQLContext).indexes.mobilityById.get(option.MobilityId) ?? null : null,
    mainSensor: (option: { MainSensorId?: number }, _: unknown, ctx: any) =>
      isPositiveId(option.MainSensorId) ? (ctx as GraphQLContext).indexes.sensorsById.get(option.MainSensorId) ?? null : null,
    extraSensor: (option: { ExtraSensorId?: number }, _: unknown, ctx: any) =>
      isPositiveId(option.ExtraSensorId) ? (ctx as GraphQLContext).indexes.sensorsById.get(option.ExtraSensorId) ?? null : null,
    abilities: (option: { Ability1Id?: number; Ability2Id?: number; Ability3Id?: number }, _: unknown, ctx: any) => {
      const { indexes } = ctx as GraphQLContext;
      const ids = [option.Ability1Id, option.Ability2Id, option.Ability3Id].filter(isPositiveId);
      return ids
        .map(id => indexes.abilitiesById.get(id))
        .filter((ability): ability is NonNullable<typeof ability> => Boolean(ability));
    },
    turrets: (option: Record<string, number>, _: unknown, ctx: any) =>
      resolveOptionTurrets(option, (ctx as GraphQLContext).indexes),
    replaceUnit: (option: { ReplaceUnitId?: number }, _: unknown, ctx: any) =>
      isPositiveId(option.ReplaceUnitId)
        ? (ctx as GraphQLContext).indexes.unitsById.get(option.ReplaceUnitId) ?? null
        : null,
  },
  Specialization: {
    country: (spec: { CountryId?: number }, _: unknown, ctx: any) =>
      isPositiveId(spec.CountryId)
        ? (ctx as GraphQLContext).indexes.countriesById.get(spec.CountryId) ?? null
        : null,
    availabilities: (spec: { Id: number }, _: unknown, ctx: any) =>
      (ctx as GraphQLContext).indexes.specializationAvailabilitiesBySpecializationId.get(spec.Id) ?? [],
  },
  SpecializationAvailability: {
    unit: (availability: { UnitId: number }, _: unknown, ctx: any) =>
      (ctx as GraphQLContext).indexes.unitsById.get(availability.UnitId) ?? null,
    transports: (availability: { Id: number }, _: unknown, ctx: any) =>
      (ctx as GraphQLContext).indexes.transportAvailabilitiesBySpecAvailabilityId.get(availability.Id) ?? [],
  },
  TransportAvailability: {
    unit: (transport: { UnitId: number }, _: unknown, ctx: any) =>
      (ctx as GraphQLContext).indexes.unitsById.get(transport.UnitId) ?? null,
    specializationAvailability: (transport: { SpecializationAvailabilityId: number }, _: unknown, ctx: any) =>
      (ctx as GraphQLContext).data.specializationAvailabilities.find(
        availability => availability.Id === transport.SpecializationAvailabilityId,
      ) ?? null,
  },
  SquadMember: {
    primaryWeapon: (member: { PrimaryWeaponId?: number }, _: unknown, ctx: any) =>
      isPositiveId(member.PrimaryWeaponId)
        ? (ctx as GraphQLContext).indexes.weaponsById.get(member.PrimaryWeaponId) ?? null
        : null,
    specialWeapon: (member: { SpecialWeaponId?: number }, _: unknown, ctx: any) =>
      isPositiveId(member.SpecialWeaponId)
        ? (ctx as GraphQLContext).indexes.weaponsById.get(member.SpecialWeaponId) ?? null
        : null,
  },
  Turret: {
    turretWeapons: (turret: { Id: number }, _: unknown, ctx: any) =>
      sortByOrder((ctx as GraphQLContext).indexes.turretWeaponsByTurretId.get(turret.Id) ?? []),
  },
  TurretWeapon: {
    weapon: (tw: { WeaponId: number }, _: unknown, ctx: any) =>
      (ctx as GraphQLContext).indexes.weaponsById.get(tw.WeaponId) ?? null,
    turret: (tw: { TurretId: number }, _: unknown, ctx: any) =>
      (ctx as GraphQLContext).indexes.turretsById.get(tw.TurretId) ?? null,
  },
};
