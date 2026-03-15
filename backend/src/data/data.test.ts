import { describe, it, expect } from 'vitest';
import { loadStaticData } from './loader.js';
import { buildIndexes } from './indexes.js';

describe('loadStaticData', () => {
  it('loads all tables without throwing (missing files return empty arrays)', async () => {
    const data = await loadStaticData();

    // Every table key must exist and be an array
    const keys = Object.keys(data) as (keyof typeof data)[];
    expect(keys.length).toBeGreaterThanOrEqual(20);

    for (const key of keys) {
      expect(Array.isArray(data[key]), `${key} should be an array`).toBe(true);
    }
  });

  it('units have required fields', async () => {
    const data = await loadStaticData();
    if (data.units.length === 0) return;

    const unit = data.units[0];
    expect(unit).toHaveProperty('Id');
    expect(unit).toHaveProperty('Name');
    expect(unit).toHaveProperty('CountryId');
    expect(unit).toHaveProperty('CategoryType');
    expect(typeof unit.Id).toBe('number');
    expect(typeof unit.Name).toBe('string');
  });

  it('weapons have required fields', async () => {
    const data = await loadStaticData();
    if (data.weapons.length === 0) return;

    const weapon = data.weapons[0];
    expect(weapon).toHaveProperty('Id');
    expect(typeof weapon.Id).toBe('number');
  });

  it('countries have required fields', async () => {
    const data = await loadStaticData();
    if (data.countries.length === 0) return;

    const country = data.countries[0];
    expect(country).toHaveProperty('Id');
    expect(country).toHaveProperty('Name');
    expect(typeof country.Name).toBe('string');
  });
});

describe('buildIndexes', () => {
  it('builds indexes from loaded data', async () => {
    const data = await loadStaticData();
    const indexes = buildIndexes(data);

    // Core indexes must be Maps
    expect(indexes.unitsById).toBeInstanceOf(Map);
    expect(indexes.turretsById).toBeInstanceOf(Map);
    expect(indexes.mobilityById).toBeInstanceOf(Map);
    expect(indexes.armorsById).toBeInstanceOf(Map);
    expect(indexes.weaponsById).toBeInstanceOf(Map);
    expect(indexes.ammunitionsById).toBeInstanceOf(Map);

    // Unit count should match
    expect(indexes.unitsById.size).toBe(data.units.length);

    // Multi-indexes should also be Maps
    expect(indexes.turretWeaponsByTurretId).toBeInstanceOf(Map);
    expect(indexes.turretUnitsByUnitId).toBeInstanceOf(Map);
    expect(indexes.unitAbilitiesByUnitId).toBeInstanceOf(Map);
  });

  it('index lookups return correct data', async () => {
    const data = await loadStaticData();
    if (data.units.length === 0) return; // skip when no data

    const indexes = buildIndexes(data);
    const firstUnit = data.units[0];
    const looked = indexes.unitsById.get(firstUnit.Id);
    expect(looked).toBeDefined();
    expect(looked!.Id).toBe(firstUnit.Id);
    expect(looked!.Name).toBe(firstUnit.Name);
  });

  it('all by-id indexes have unique entries (no duplicate Ids)', async () => {
    const data = await loadStaticData();
    const indexes = buildIndexes(data);

    // Each by-id map size should equal the source array length
    expect(indexes.unitsById.size).toBe(data.units.length);
    expect(indexes.weaponsById.size).toBe(data.weapons.length);
    expect(indexes.ammunitionsById.size).toBe(data.ammunitions.length);
    expect(indexes.turretsById.size).toBe(data.turrets.length);
    expect(indexes.countriesById.size).toBe(data.countries.length);
  });

  it('turret weapon references point to existing weapons', async () => {
    const data = await loadStaticData();
    if (data.turretWeapons.length === 0) return;

    const indexes = buildIndexes(data);
    let checked = 0;
    for (const tw of data.turretWeapons) {
      const weapon = indexes.weaponsById.get(tw.WeaponId);
      // Every turret-weapon junction should reference a valid weapon
      expect(weapon, `TurretWeapon.WeaponId=${tw.WeaponId} should exist`).toBeDefined();
      checked++;
      if (checked >= 50) break; // sample check, don't iterate everything
    }
  });

  it('unit country references point to existing countries', async () => {
    const data = await loadStaticData();
    if (data.units.length === 0) return;

    const indexes = buildIndexes(data);
    for (const unit of data.units) {
      const country = indexes.countriesById.get(unit.CountryId);
      expect(country, `Unit "${unit.Name}" CountryId=${unit.CountryId} should reference a valid country`).toBeDefined();
    }
  });
});
