import type {
  Ability, UnitAbility,
  Ammunition, WeaponAmmunition,
  Armor, UnitArmor,
  Country,
  FlyPreset, Mobility, UnitPropulsion,
  Modification, Option,
  Sensor, SensorUnit,
  Specialization, SpecializationAvailability,
  SquadMember, SquadWeapon,
  TransportAvailability,
  Turret, TurretUnit, TurretWeapon,
  Unit,
  Weapon,
} from '@ba-hub/shared';
import type { StaticData } from './loader.js';

export interface StaticIndexes {
  // By-id maps
  abilitiesById: Map<number, Ability>;
  ammunitionsById: Map<number, Ammunition>;
  armorsById: Map<number, Armor>;
  countriesById: Map<number, Country>;
  flyPresetsById: Map<number, FlyPreset>;
  mobilityById: Map<number, Mobility>;
  modificationsById: Map<number, Modification>;
  optionsById: Map<number, Option>;
  sensorsById: Map<number, Sensor>;
  specializationsById: Map<number, Specialization>;
  specializationAvailabilitiesById: Map<number, SpecializationAvailability>;
  turretsById: Map<number, Turret>;
  unitsById: Map<number, Unit>;
  weaponsById: Map<number, Weapon>;
  // Grouped relations
  unitAbilitiesByUnitId: Map<number, UnitAbility[]>;
  unitArmorsByUnitId: Map<number, UnitArmor[]>;
  unitPropulsionsByUnitId: Map<number, UnitPropulsion[]>;
  sensorUnitsByUnitId: Map<number, SensorUnit[]>;
  turretUnitsByUnitId: Map<number, TurretUnit[]>;
  turretWeaponsByTurretId: Map<number, TurretWeapon[]>;
  weaponAmmunitionsByUnitId: Map<number, WeaponAmmunition[]>;
  squadMembersByUnitId: Map<number, SquadMember[]>;
  squadWeaponsByUnitId: Map<number, SquadWeapon[]>;
  modificationsByUnitId: Map<number, Modification[]>;
  optionsByModificationId: Map<number, Option[]>;
  specializationAvailabilitiesBySpecializationId: Map<number, SpecializationAvailability[]>;
  specializationAvailabilitiesByUnitId: Map<number, SpecializationAvailability[]>;
  // Set of unit IDs that exist in some spec — either as a direct deck pick
  // (SpecializationAvailability), a transport for another unit's slot
  // (TransportAvailability, e.g. Bradley carries infantry, K-16 carries squad),
  // or a variant reached through another unit's modification option
  // (Option.ReplaceUnitId, e.g. Marines reached via Reserve Marines + option).
  // Variants link back to their root via `variantRoots` so click targets
  // open the root unit with the option pre-applied. Used to filter out true
  // wrappers and pseudo units (e.g. C-17 takeoff) from search and arsenal.
  playableUnitIds: Set<number>;
  // For variants only — the (rootUnitId, optionId) the frontend should link
  // to so the modification system loads correctly. Absent for units picked
  // directly. First-wins if a unit is targeted by multiple options
  // (currently no such case exists in the data).
  variantRoots: Map<number, { rootUnitId: number; optionId: number }>;
  transportAvailabilitiesBySpecAvailabilityId: Map<number, TransportAvailability[]>;
  transportAvailabilitiesByUnitId: Map<number, TransportAvailability[]>;
  turretsByParentTurretId: Map<number, Turret[]>;
}

function mapById<T extends { Id: number }>(items: T[]): Map<number, T> {
  return new Map(items.map(item => [item.Id, item]));
}

function groupBy<T, K extends number>(items: T[], getKey: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const existing = map.get(key);
    if (existing) {
      existing.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

export function buildIndexes(data: StaticData): StaticIndexes {
  return {
    abilitiesById: mapById(data.abilities),
    ammunitionsById: mapById(data.ammunitions),
    armorsById: mapById(data.armors),
    countriesById: mapById(data.countries),
    flyPresetsById: mapById(data.flyPresets),
    mobilityById: mapById(data.mobility),
    modificationsById: mapById(data.modifications),
    optionsById: mapById(data.options),
    sensorsById: mapById(data.sensors),
    specializationsById: mapById(data.specializations),
    specializationAvailabilitiesById: mapById(data.specializationAvailabilities),
    turretsById: mapById(data.turrets),
    unitsById: mapById(data.units),
    weaponsById: mapById(data.weapons),
    unitAbilitiesByUnitId: groupBy(data.unitAbilities, ua => ua.UnitId),
    unitArmorsByUnitId: groupBy(data.unitArmors, ua => ua.UnitId),
    unitPropulsionsByUnitId: groupBy(data.unitPropulsions, up => up.UnitId),
    sensorUnitsByUnitId: groupBy(data.sensorUnits, su => su.UnitId),
    turretUnitsByUnitId: groupBy(data.turretUnits, tu => tu.UnitId),
    turretWeaponsByTurretId: groupBy(data.turretWeapons, tw => tw.TurretId),
    weaponAmmunitionsByUnitId: groupBy(data.weaponAmmunitions, wa => wa.UnitId),
    squadMembersByUnitId: groupBy(data.squadMembers, sm => sm.UnitId),
    squadWeaponsByUnitId: groupBy(data.squadWeapons, sw => sw.UnitId),
    modificationsByUnitId: groupBy(data.modifications, mod => mod.UnitId),
    optionsByModificationId: groupBy(data.options, opt => opt.ModificationId),
    specializationAvailabilitiesBySpecializationId: groupBy(data.specializationAvailabilities, sa => sa.SpecializationId),
    specializationAvailabilitiesByUnitId: groupBy(data.specializationAvailabilities, sa => sa.UnitId),
    ...(() => {
      const ids = new Set<number>();
      for (const sa of data.specializationAvailabilities) ids.add(sa.UnitId);
      for (const ta of data.transportAvailabilities) ids.add(ta.UnitId);
      const variantRoots = new Map<number, { rootUnitId: number; optionId: number }>();
      // First-wins: skip if already mapped, so deterministic across reloads.
      const modById = new Map(data.modifications.map(m => [m.Id, m]));
      for (const opt of data.options) {
        const replaceId = (opt as { ReplaceUnitId?: number }).ReplaceUnitId;
        if (!replaceId || replaceId <= 0) continue;
        const mod = modById.get(opt.ModificationId);
        if (!mod) continue;
        // Skip identity options — a unit's own modification that replaces it
        // with itself is the default loadout, not a variant of another unit.
        if (mod.UnitId === replaceId) continue;
        if (variantRoots.has(replaceId)) continue;
        variantRoots.set(replaceId, { rootUnitId: mod.UnitId, optionId: opt.Id });
        ids.add(replaceId);
      }
      return { playableUnitIds: ids, variantRoots };
    })(),
    transportAvailabilitiesBySpecAvailabilityId: groupBy(
      data.transportAvailabilities,
      ta => ta.SpecializationAvailabilityId,
    ),
    transportAvailabilitiesByUnitId: groupBy(data.transportAvailabilities, ta => ta.UnitId),
    turretsByParentTurretId: groupBy(
      data.turrets.filter(t => t.ParentTurretId > 0),
      t => t.ParentTurretId,
    ),
  };
}