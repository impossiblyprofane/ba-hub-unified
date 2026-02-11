import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the `data/static/` directory. */
const STATIC_DIR = join(__dirname, '..', 'data', 'static');

/**
 * Generic helper — reads a JSON file from the static directory and returns
 * the parsed result typed as `T[]`.
 */
async function loadJsonArray<T>(filename: string): Promise<T[]> {
  const filepath = join(STATIC_DIR, filename);
  try {
    const raw = await readFile(filepath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected a JSON array in ${filename}, got ${typeof parsed}`);
    }
    return parsed as T[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`⚠️  Static data file not found: ${filepath} — returning empty array`);
      return [];
    }
    throw err;
  }
}

/** All static data tables, loaded once at startup. */
export interface StaticData {
  // Core entities
  abilities: Ability[];
  ammunitions: Ammunition[];
  armors: Armor[];
  countries: Country[];
  flyPresets: FlyPreset[];
  mobility: Mobility[];
  modifications: Modification[];
  options: Option[];
  sensors: Sensor[];
  specializations: Specialization[];
  turrets: Turret[];
  units: Unit[];
  weapons: Weapon[];
  // Junction / linking tables
  sensorUnits: SensorUnit[];
  specializationAvailabilities: SpecializationAvailability[];
  squadMembers: SquadMember[];
  squadWeapons: SquadWeapon[];
  transportAvailabilities: TransportAvailability[];
  turretUnits: TurretUnit[];
  turretWeapons: TurretWeapon[];
  unitAbilities: UnitAbility[];
  unitArmors: UnitArmor[];
  unitPropulsions: UnitPropulsion[];
  weaponAmmunitions: WeaponAmmunition[];
}

/**
 * Load every static JSON table from disk.
 * Call once during server init and pass the result into your GraphQL context.
 */
export async function loadStaticData(): Promise<StaticData> {
  const [
    abilities, ammunitions, armors, countries, flyPresets, mobility,
    modifications, options, sensors, specializations, turrets, units, weapons,
    sensorUnits, specializationAvailabilities, squadMembers, squadWeapons,
    transportAvailabilities, turretUnits, turretWeapons,
    unitAbilities, unitArmors, unitPropulsions, weaponAmmunitions,
  ] = await Promise.all([
    // Core entities
    loadJsonArray<Ability>('Abilities.json'),
    loadJsonArray<Ammunition>('Ammunitions.json'),
    loadJsonArray<Armor>('Armors.json'),
    loadJsonArray<Country>('Countries.json'),
    loadJsonArray<FlyPreset>('FlyPresets.json'),
    loadJsonArray<Mobility>('Mobility.json'),
    loadJsonArray<Modification>('Modifications.json'),
    loadJsonArray<Option>('Options.json'),
    loadJsonArray<Sensor>('Sensors.json'),
    loadJsonArray<Specialization>('Specializations.json'),
    loadJsonArray<Turret>('Turrets.json'),
    loadJsonArray<Unit>('Units.json'),
    loadJsonArray<Weapon>('Weapons.json'),
    // Junction tables
    loadJsonArray<SensorUnit>('SensorUnits.json'),
    loadJsonArray<SpecializationAvailability>('SpecializationAvailabilities.json'),
    loadJsonArray<SquadMember>('SquadMembers.json'),
    loadJsonArray<SquadWeapon>('SquadWeapons.json'),
    loadJsonArray<TransportAvailability>('TransportAvailabilities.json'),
    loadJsonArray<TurretUnit>('TurretUnits.json'),
    loadJsonArray<TurretWeapon>('TurretWeapons.json'),
    loadJsonArray<UnitAbility>('UnitAbilities.json'),
    loadJsonArray<UnitArmor>('UnitArmors.json'),
    loadJsonArray<UnitPropulsion>('UnitPropulsions.json'),
    loadJsonArray<WeaponAmmunition>('WeaponAmmunitions.json'),
  ]);

  const tables = {
    abilities, ammunitions, armors, countries, flyPresets, mobility,
    modifications, options, sensors, specializations, turrets, units, weapons,
    sensorUnits, specializationAvailabilities, squadMembers, squadWeapons,
    transportAvailabilities, turretUnits, turretWeapons,
    unitAbilities, unitArmors, unitPropulsions, weaponAmmunitions,
  };

  const counts = Object.entries(tables)
    .map(([k, v]) => `${v.length} ${k}`)
    .join(', ');
  console.log(`📦 Static data loaded — ${counts}`);

  return tables;
}

