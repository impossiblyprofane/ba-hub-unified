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
  transportAvailabilitiesBySpecAvailabilityId: Map<number, TransportAvailability[]>;
  transportAvailabilitiesByUnitId: Map<number, TransportAvailability[]>;
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
    transportAvailabilitiesBySpecAvailabilityId: groupBy(
      data.transportAvailabilities,
      ta => ta.SpecializationAvailabilityId,
    ),
    transportAvailabilitiesByUnitId: groupBy(data.transportAvailabilities, ta => ta.UnitId),
  };
}