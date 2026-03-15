import { describe, it, expect } from 'vitest';
import { WeaponType, weaponTypeToString } from './weapon-types';
import { TrajectoryType, trajectoryTypeToString, trajectoryTypeDescription } from './trajectory-types';
import { SeekerType, seekerTypeToString, seekerTypeDescription } from './seeker-types';
import { getCategoryById, CATEGORIES } from './categories';
import {
  toUnitIconPath,
  toCountryIconPath,
  toSpecializationIconPath,
  toWeaponIconPath,
  toAmmunitionIconPath,
  toPortraitIconPath,
  toOptionPicturePath,
  encodeIconPath,
} from './iconPaths';

// ── weaponTypeToString ──────────────────────────────────────────

describe('weaponTypeToString', () => {
  it('returns i18n key for every known weapon type', () => {
    const entries = Object.entries(WeaponType) as [string, number][];
    for (const [name, value] of entries) {
      const key = weaponTypeToString(value);
      expect(key).toMatch(/^unitViewer\.weapons\.types\.weapon\./);
      if (name === 'NotAssigned') {
        expect(key).toBe('unitViewer.weapons.types.weapon.notAssigned');
      } else {
        expect(key).not.toBe('unitViewer.weapons.types.weapon.notAssigned');
      }
    }
  });

  it('returns notAssigned key for unknown values', () => {
    expect(weaponTypeToString(9999)).toBe('unitViewer.weapons.types.weapon.notAssigned');
    expect(weaponTypeToString(-1)).toBe('unitViewer.weapons.types.weapon.notAssigned');
  });

  it('maps specific weapons correctly', () => {
    expect(weaponTypeToString(WeaponType.Rifle)).toBe('unitViewer.weapons.types.weapon.rifle');
    expect(weaponTypeToString(WeaponType.ATGM)).toBe('unitViewer.weapons.types.weapon.atgm');
    expect(weaponTypeToString(WeaponType.MainGun)).toBe('unitViewer.weapons.types.weapon.mainGun');
    expect(weaponTypeToString(WeaponType.BombSmart)).toBe('unitViewer.weapons.types.weapon.bombSmart');
  });
});

// ── trajectoryTypeToString ──────────────────────────────────────

describe('trajectoryTypeToString', () => {
  it('returns i18n key for every known trajectory type', () => {
    const entries = Object.entries(TrajectoryType) as [string, number][];
    for (const [, value] of entries) {
      const key = trajectoryTypeToString(value);
      expect(key).toMatch(/^unitViewer\.weapons\.types\.trajectory\./);
    }
  });

  it('returns none for unknown values', () => {
    expect(trajectoryTypeToString(9999)).toBe('unitViewer.weapons.types.trajectory.none');
  });

  it('maps specific trajectories correctly', () => {
    expect(trajectoryTypeToString(TrajectoryType.DirectShot)).toBe('unitViewer.weapons.types.trajectory.directShot');
    expect(trajectoryTypeToString(TrajectoryType.DeadMissile)).toBe('unitViewer.weapons.types.trajectory.deadMissile');
  });
});

// ── trajectoryTypeDescription ───────────────────────────────────

describe('trajectoryTypeDescription', () => {
  it('returns description key for known types (except None)', () => {
    expect(trajectoryTypeDescription(TrajectoryType.DirectShot)).toBe('unitViewer.weapons.types.trajectory.desc.directShot');
    expect(trajectoryTypeDescription(TrajectoryType.Artillery)).toBe('unitViewer.weapons.types.trajectory.desc.artillery');
  });

  it('returns empty string for None and unknown', () => {
    expect(trajectoryTypeDescription(TrajectoryType.None)).toBe('');
    expect(trajectoryTypeDescription(9999)).toBe('');
  });
});

// ── seekerTypeToString ──────────────────────────────────────────

describe('seekerTypeToString', () => {
  it('returns i18n key for every known seeker type', () => {
    const entries = Object.entries(SeekerType) as [string, number][];
    for (const [, value] of entries) {
      const key = seekerTypeToString(value);
      expect(key).toMatch(/^unitViewer\.weapons\.types\.seeker\./);
    }
  });

  it('returns none for unknown values', () => {
    expect(seekerTypeToString(9999)).toBe('unitViewer.weapons.types.seeker.none');
  });
});

// ── seekerTypeDescription ───────────────────────────────────────

describe('seekerTypeDescription', () => {
  it('returns description key for non-None types', () => {
    expect(seekerTypeDescription(SeekerType.Active)).toBe('unitViewer.weapons.types.seeker.desc.active');
    expect(seekerTypeDescription(SeekerType.Laser)).toBe('unitViewer.weapons.types.seeker.desc.laser');
  });

  it('returns empty string for None and unknown', () => {
    expect(seekerTypeDescription(SeekerType.None)).toBe('');
    expect(seekerTypeDescription(9999)).toBe('');
  });
});

// ── getCategoryById ─────────────────────────────────────────────

describe('getCategoryById', () => {
  it('returns correct category for known ids', () => {
    const recon = getCategoryById(0);
    expect(recon.code).toBe('Rec');
    expect(recon.name).toBe('Recon');

    const infantry = getCategoryById(1);
    expect(infantry.code).toBe('Inf');
  });

  it('returns unknown for missing ids', () => {
    const unknown = getCategoryById(999);
    expect(unknown.name).toBe('Unknown');
    expect(unknown.code).toBe('Unk');
  });

  it('has all expected categories', () => {
    expect(CATEGORIES).toHaveLength(7);
    expect(CATEGORIES.map(c => c.id)).toEqual([0, 1, 2, 3, 5, 6, 7]);
  });
});

// ── iconPaths ───────────────────────────────────────────────────

describe('iconPaths', () => {
  it('encodeIconPath encodes spaces in filenames', () => {
    expect(encodeIconPath('/images/ui/Cluster Ammo Icon.png')).toBe('/images/ui/Cluster%20Ammo%20Icon.png');
  });

  it('encodeIconPath passes through clean paths', () => {
    expect(encodeIconPath('/images/flags/US.png')).toBe('/images/flags/US.png');
  });

  it('toUnitIconPath uppercases and appends .png', () => {
    expect(toUnitIconPath('m1_abrams')).toBe('/images/labels/icons/M1_ABRAMS.png');
  });

  it('toCountryIconPath appends flag directory', () => {
    expect(toCountryIconPath('US')).toBe('/images/flags/US.png');
  });

  it('toSpecializationIconPath builds spec path', () => {
    // Note: encodeIconPath only encodes the filename, not directory segments
    expect(toSpecializationIconPath('mechanized')).toBe('/images/icon specialisation/mechanized.png');
  });

  it('toWeaponIconPath uppercases', () => {
    expect(toWeaponIconPath('ak74')).toBe('/images/weapons/AK74.png');
  });

  it('toAmmunitionIconPath uppercases', () => {
    expect(toAmmunitionIconPath('he_frag')).toBe('/images/ammunition/HE_FRAG.png');
  });

  it('toPortraitIconPath splits backslash paths', () => {
    const result = toPortraitIconPath('usa\\tanks\\M1_ABRAMS');
    expect(result).toBe('/images/unitportrait/usa/tanks/M1_ABRAMS_BASIC.png');
  });

  it('toOptionPicturePath routes weapons correctly', () => {
    const result = toOptionPicturePath('Weapons\\M2_BROWNING');
    expect(result).toBe('/images/weapons/M2_BROWNING.png');
  });

  it('toOptionPicturePath routes modifications to outline', () => {
    const result = toOptionPicturePath('Modifications\\ARMOR1');
    expect(result).toBe('/images/modifications/outline/ARMOR1.png');
  });
});
