import { component$, useSignal } from '@builder.io/qwik';
import { GameIcon } from '~/components/GameIcon';
import { UtilIconPaths, toWeaponIconPath, toAmmunitionIconPath } from '~/lib/iconPaths';
import { seekerTypeToString, seekerTypeDescription } from '~/lib/seeker-types';
import { trajectoryTypeToString, trajectoryTypeDescription } from '~/lib/trajectory-types';
import { useI18n, t } from '~/lib/i18n';
import { SimpleTooltip } from '~/components/ui/SimpleTooltip';
import type { UnitDetailWeapon, UnitDetailAmmo, UnitDetailAbility } from '~/lib/graphql-types';

type Props = {
  weapons: UnitDetailWeapon[];
  unitId: number;
  unitType?: number;
  abilities?: UnitDetailAbility[];
};

/**
 * Effective damage-event rate in events-per-minute. The game-data
 * `ShotsPerBurst` field is the *visual* round count (e.g. an MMG sprays
 * 4-8 rounds per trigger pull) but each burst applies a single damage event
 * to the target — burst size and `TimeBetweenShotsInBurst` are cosmetic, so
 * we count trigger-pulls, not bullets.
 *
 * Reload time is amortized across the magazine so that mag-1 weapons (tank
 * cannons, SAMs) reflect the per-mag reload rather than just the cooldown
 * between identical shots in a non-existent burst. For mag-30 rifles the
 * amortized term is negligible (~0.1s per shot).
 *
 *   cycle = avgInterBurst + avgReload / max(mag, 1)
 *   rpm   = 60 / cycle
 *
 * Returns 0 when no cycle is defined (e.g. one-shot grenade launchers with
 * no inter-burst time and no reload), in which case we hide the stat.
 */
function computeRpm(w: UnitDetailWeapon['weapon']): number {
  const interMin = w.TimeBetweenBurstsMin || 0;
  const interMax = w.TimeBetweenBurstsMax || interMin;
  const interAvg = (interMin + interMax) / 2;
  const reloadMin = w.MagazineReloadTimeMin || 0;
  const reloadMax = w.MagazineReloadTimeMax || reloadMin;
  const reloadAvg = (reloadMin + reloadMax) / 2;
  const mag = Math.max(w.MagazineSize || 1, 1);
  const cycle = interAvg + reloadAvg / mag;
  if (cycle <= 0) return 0;
  return 60 / cycle;
}

/** Weapon Types where DPS is a meaningful summary — sustained-fire small arms
 *  (rifles, DMRs, snipers, SMGs, MMGs, autorifles, shotguns). UGL/AGL grenade
 *  launchers, rocket launchers, ATGMs, MANPADS etc. fire single high-damage
 *  rounds at infrequent intervals where DPS is misleading. */
const RIFLE_LIKE_WEAPON_TYPES = new Set([
  1,  // Rifle (assault rifle, semi-auto rifle)
  2,  // DMR
  3,  // Sniper
  4,  // Sniper (heavy)
  5,  // Rifle (silenced/variant)
  6,  // Rifle (variant)
  25, // SMG
  26, // MMG (infantry)
  30, // Autorifle (LMG)
  40, // Shotgun
]);

/** True when DPS is meaningful for this unit+weapon combination. */
function shouldShowDpsFor(unitType: number | undefined, weaponType: number): boolean {
  // Type 2 = infantry. Vehicle/heli/jet weapons (including those mounted on
  // vehicles) get raw per-round damage instead.
  if (unitType !== 2) return false;
  return RIFLE_LIKE_WEAPON_TYPES.has(weaponType);
}

/* ── Target type icons ─────────────────────────────────────────── */

const TARGET_ICONS: Record<number, string> = {
  1: UtilIconPaths.TARGET_TYPE_INF,
  2: UtilIconPaths.TARGET_TYPE_VEH,
  4: UtilIconPaths.TARGET_TYPE_HELI,
  8: UtilIconPaths.TARGET_TYPE_AIRCRAFT,
  16: UtilIconPaths.TARGET_TYPE_MISSILE,
};

const ARMOR_TYPE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'KE', color: 'text-[#7eb8e0]' },
  2: { label: 'HEAT', color: 'text-[#e8a050]' },
};

function getTargetBits(targetType: number): number[] {
  const bits: number[] = [];
  for (const bit of Object.keys(TARGET_ICONS)) {
    if ((targetType & Number(bit)) !== 0) bits.push(Number(bit));
  }
  return bits;
}

/* ── Merge / dedup logic ───────────────────────────────────────── */

type MergedWeapon = { count: number; entry: UnitDetailWeapon; isMerged: boolean };

/**
 * Merges weapons following the game-data convention:
 *
 * 1. **Mergeable** (`CanBeMerged`): group by first ammunition ID.
 *    `count` = sum of first-ammo quantities across instances.
 *    HUDMultiplier is NOT applied (already baked into game display qty).
 *
 * 2. **Non-mergeable**: group by weapon ID.
 *    `count` = number of weapon instances.
 *    Ammo quantities are summed across instances with HUDMultiplier applied.
 */
function mergeWeapons(weapons: UnitDetailWeapon[]): MergedWeapon[] {
  const mergeable: MergedWeapon[] = [];
  const nonMergeable: MergedWeapon[] = [];

  for (const w of weapons) {
    if (w.weapon.CanBeMerged) {
      // Merge key = first ammunition ID
      const firstAmmoId = w.ammunition[0]?.ammunition.Id;
      if (firstAmmoId == null) continue;

      const existing = mergeable.find(
        m => m.entry.ammunition[0]?.ammunition.Id === firstAmmoId,
      );
      if (existing) {
        existing.count += w.ammunition[0].quantity;
      } else {
        mergeable.push({
          count: w.ammunition[0].quantity,
          entry: w,
          isMerged: true,
        });
      }
    } else {
      // Merge key = weapon ID
      const existing = nonMergeable.find(m => m.entry.weapon.Id === w.weapon.Id);
      if (existing) {
        existing.count += 1;
        // Aggregate ammo quantities with HUDMultiplier
        for (const newAmmo of w.ammunition) {
          const mult = newAmmo.ammunition.HUDMultiplier || 1;
          const match = existing.entry.ammunition.find(
            a => a.ammunition.Id === newAmmo.ammunition.Id,
          );
          if (match) {
            match.quantity += newAmmo.quantity * mult;
          } else {
            existing.entry.ammunition.push({
              ammunition: newAmmo.ammunition,
              quantity: newAmmo.quantity * mult,
              order: newAmmo.order,
            });
          }
        }
      } else {
        // Deep-copy ammo with HUDMultiplier baked in on first occurrence
        nonMergeable.push({
          count: 1,
          entry: {
            weapon: w.weapon,
            turret: w.turret,
            ammunition: w.ammunition.map(a => ({
              ammunition: a.ammunition,
              quantity: a.quantity * (a.ammunition.HUDMultiplier || 1),
              order: a.order,
            })),
          },
          isMerged: false,
        });
      }
    }
  }

  // Mark non-mergeable as merged if count > 1
  for (const nm of nonMergeable) {
    if (nm.count > 1) nm.isMerged = true;
  }

  return [...mergeable, ...nonMergeable];
}

/* ── Check if any ammo has alt ranges ─────────────────────────── */

function hasAnyAltRange(weapons: UnitDetailWeapon[]): { hasLowAlt: boolean; hasHighAlt: boolean } {
  let hasLowAlt = false;
  let hasHighAlt = false;
  for (const w of weapons) {
    for (const a of w.ammunition) {
      if (a.ammunition.LowAltRange > 0) hasLowAlt = true;
      if (a.ammunition.HighAltRange > 0) hasHighAlt = true;
    }
  }
  return { hasLowAlt, hasHighAlt };
}

/* ── Weapons Panel ─────────────────────────────────────────────── */

export const UnitWeaponsPanel = component$<Props>(({ weapons, unitType, abilities }) => {
  const merged = mergeWeapons(weapons);
  const { hasLowAlt, hasHighAlt } = hasAnyAltRange(weapons);

  // Extract radar weapon range modifiers if present
  const radar = abilities?.find(a => a.IsRadar) ?? null;
  const radarLowAltWpnMod = radar?.RadarLowAltWeaponRangeModifier ?? 0;
  const radarHighAltWpnMod = radar?.RadarHighAltWeaponRangeModifier ?? 0;
  const hasRadarRange = radarLowAltWpnMod > 0 && radarLowAltWpnMod !== 1
    || radarHighAltWpnMod > 0 && radarHighAltWpnMod !== 1;

  return (
    <div class="flex flex-col gap-4">
      {merged.map((g, idx) => (
        <WeaponSection
          key={`${g.entry.weapon.Id}-${idx}`}
          entry={g.entry}
          count={g.count}
          isMerged={g.isMerged}
          showLowAlt={hasLowAlt}
          showHighAlt={hasHighAlt}
          radarLowAltMod={hasRadarRange ? radarLowAltWpnMod : 0}
          radarHighAltMod={hasRadarRange ? radarHighAltWpnMod : 0}
          showDps={shouldShowDpsFor(unitType, g.entry.weapon.Type)}
        />
      ))}
    </div>
  );
});

/* ── Weapon Section ────────────────────────────────────────────── */

type WeaponSectionProps = {
  entry: UnitDetailWeapon;
  count: number;
  isMerged: boolean;
  showLowAlt: boolean;
  showHighAlt: boolean;
  radarLowAltMod: number;
  radarHighAltMod: number;
  showDps: boolean;
};

const WeaponSection = component$<WeaponSectionProps>(({ entry, count, isMerged, showLowAlt, showHighAlt, radarLowAltMod, radarHighAltMod, showDps }) => {
  const i18nWs = useI18n();
  const { weapon, turret, ammunition } = entry;
  const weaponIcon = weapon.HUDIcon ? toWeaponIconPath(weapon.HUDIcon) : null;

  const mag = weapon.MagazineSize;
  const reloadMin = weapon.MagazineReloadTimeMin;
  const reloadMax = weapon.MagazineReloadTimeMax;
  const aimMin = weapon.AimTimeMin;
  const aimMax = weapon.AimTimeMax;
  const reload = reloadMin === reloadMax ? `${reloadMin}s` : `${reloadMin}–${reloadMax}s`;
  const aim = aimMin === aimMax ? `${aimMin}s` : `${aimMin}–${aimMax}s`;
  const weaponRpm = computeRpm(weapon);

  return (
    <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] border-l-[3px] border-l-[var(--accent)]">
      {/* Weapon header bar */}
      <div class="flex items-center gap-3 px-4 py-3 border-b border-[rgba(51,51,51,0.3)]">
        {weaponIcon && <GameIcon src={weaponIcon} size={24} variant="white" alt={weapon.HUDName} />}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-base font-semibold text-[var(--text)] truncate">
              {weapon.HUDName}
            </p>
            {count > 1 && (
              <SimpleTooltip text={isMerged ? `${count} combined from multiple mounts` : `${count} instances`}>
                <span
                  class="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[var(--accent)]/20 text-[var(--accent)] rounded"
                >
                  {count}×
                </span>
              </SimpleTooltip>
            )}
          </div>
          {turret && (
            <p class="text-xs font-mono text-[var(--text-dim)]">
              {turret.FullRotation ? '360°' : `${turret.LeftHorizontalAngle}°–${turret.RightHorizontalAngle}°`}
              {' · '}{turret.HorizontalRotationSpeed}°/s
            </p>
          )}
        </div>

        {/* Trait badges */}
        <div class="flex flex-wrap gap-1 shrink-0 mr-4">
          {weapon.AutoLoaded && <TraitPill label="AUTO" title="Auto Loaded" />}
          {weapon.IsVerticalLauncher && <TraitPill label="VLS" title="Vertical Launch System" />}
          {!weapon.CanShootOnTheMove && <TraitPill label="STATIC" title="Cannot fire on the move" />}
          {weapon.MultiTargetTracking > 1 && <TraitPill label={`MTT ×${weapon.MultiTargetTracking}`} title={`Multi-Target Tracking: ${weapon.MultiTargetTracking}`} />}
          {weapon.SimultaneousTracking > 1 && <TraitPill label={`SIM ×${weapon.SimultaneousTracking}`} title={`Simultaneous Tracking: ${weapon.SimultaneousTracking}`} />}
        </div>

        {/* Weapon stats row */}
        <div class="flex items-center gap-4 text-xs font-mono text-[var(--text-dim)] shrink-0">
          <span>MAG <span class="text-[var(--text)] font-semibold">{mag}</span></span>
          <span>RLD <span class="text-[var(--text)] font-semibold">{reload}</span></span>
          <span>AIM <span class="text-[var(--text)] font-semibold">{aim}</span></span>
          {weapon.ShotsPerBurstMax > 1 && (
            <span>BURST <span class="text-[var(--text)] font-semibold">{weapon.ShotsPerBurstMin === weapon.ShotsPerBurstMax ? weapon.ShotsPerBurstMax : `${weapon.ShotsPerBurstMin}–${weapon.ShotsPerBurstMax}`}</span></span>
          )}
          {weapon.StabilizerQuality > 0 && (
            <span>STAB <span class="text-[var(--text)] font-semibold">{weapon.StabilizerQuality}</span></span>
          )}
          {weaponRpm > 0 && (
            <span>RPM <span class="text-[var(--text)] font-semibold">{Math.round(weaponRpm)}</span></span>
          )}
        </div>
      </div>

      {/* Ammo table */}
      {ammunition.length > 0 && (
        <div class="overflow-x-auto">
          <table class="w-full text-sm font-mono" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col />
              <col style={{ width: '55px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '45px' }} />
              <col style={{ width: '50px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '95px' }} />
              {showLowAlt && <col style={{ width: '70px' }} />}
              {showHighAlt && <col style={{ width: '70px' }} />}
              <col style={{ width: '60px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '24px' }} />
            </colgroup>
            <thead>
              <tr class="text-[11px] uppercase tracking-widest text-[var(--text-dim)] border-b border-[rgba(51,51,51,0.3)] bg-[rgba(26,26,26,0.4)]">
                <th class="text-left px-4 py-2 font-normal">{t(i18nWs, 'unitDetail.weapons.ammunition')}</th>
                <th class="text-center px-2 py-2 font-normal">{t(i18nWs, 'unitDetail.weapons.type')}</th>
                <th class="text-center px-2 py-2 font-normal">{t(i18nWs, 'unitDetail.weapons.targets')}</th>
                <th class="text-right px-2 py-2 font-normal">{t(i18nWs, 'unitDetail.weapons.dmg')}</th>
                <th class="text-right px-2 py-2 font-normal">{t(i18nWs, 'unitDetail.weapons.stress')}</th>
                <th class="text-right px-2 py-2 font-normal">{t(i18nWs, 'unitDetail.weapons.pen')}</th>
                <th class="text-right px-2 py-2 font-normal">{t(i18nWs, 'unitDetail.weapons.range')}</th>
                {showLowAlt && <th class="text-right px-2 py-2 font-normal whitespace-nowrap">{t(i18nWs, 'unitDetail.weapons.lowAlt')}</th>}
                {showHighAlt && <th class="text-right px-2 py-2 font-normal whitespace-nowrap">{t(i18nWs, 'unitDetail.weapons.highAlt')}</th>}
                <th class="text-right px-2 py-2 font-normal">{t(i18nWs, 'unitDetail.weapons.velocity')}</th>
                <th class="text-left px-2 py-2 font-normal">{t(i18nWs, 'unitDetail.weapons.traits')}</th>
                <th class="px-1 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {ammunition.map((slot, i) => (
                <AmmoTableRow
                  key={`${slot.ammunition.Id}-${i}`}
                  ammo={slot.ammunition}
                  quantity={slot.quantity}
                  showLowAlt={showLowAlt}
                  showHighAlt={showHighAlt}
                  colSpanTotal={10 + (showLowAlt ? 1 : 0) + (showHighAlt ? 1 : 0)}
                  radarLowAltMod={radarLowAltMod}
                  radarHighAltMod={radarHighAltMod}
                  weaponRpm={showDps ? weaponRpm : 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

/* ── Ammo Table Row ────────────────────────────────────────────── */

type AmmoTableRowProps = {
  ammo: UnitDetailAmmo;
  quantity: number;
  showLowAlt: boolean;
  showHighAlt: boolean;
  colSpanTotal: number;
  radarLowAltMod: number;
  radarHighAltMod: number;
  /** Weapon RPM for DPS calc; 0 means hide DPS (non-infantry weapons). */
  weaponRpm: number;
};

const AmmoTableRow = component$<AmmoTableRowProps>(({ ammo, quantity, showLowAlt, showHighAlt, colSpanTotal, radarLowAltMod, radarHighAltMod, weaponRpm }) => {
  const i18n = useI18n();
  const expanded = useSignal(false);
  const ammoIcon = ammo.HUDIcon ? toAmmunitionIconPath(ammo.HUDIcon) : null;
  const armorType = ARMOR_TYPE_LABELS[ammo.ArmorTargeted];
  const range = Math.round((ammo.GroundRange || 0) * 2);
  const minRange = Math.round((ammo.MinimalRange || 0) * 2);
  const lowAlt = Math.round((ammo.LowAltRange || 0) * 2);
  const highAlt = Math.round((ammo.HighAltRange || 0) * 2);
  const penClose = ammo.PenetrationAtMinRange || 0;
  const penFar = ammo.PenetrationAtGroundRange || 0;
  const targetBits = getTargetBits(ammo.TargetType);

  // Collect trait labels
  const traits: { label: string; variant?: string; title?: string }[] = [];

  const trajectoryLabel = t(i18n, trajectoryTypeToString(ammo.TrajectoryType));
  const trajectoryDescKey = trajectoryTypeDescription(ammo.TrajectoryType);
  const trajectoryDesc = trajectoryDescKey ? t(i18n, trajectoryDescKey) : '';

  const seekerLabel = ammo.Seeker > 0
    ? (t(i18n, seekerTypeToString(ammo.Seeker)) || 'GUIDED')
    : null;
  const seekerDescKey = ammo.Seeker > 0 ? seekerTypeDescription(ammo.Seeker) : '';
  const seekerDesc = seekerDescKey ? t(i18n, seekerDescKey) : null;

  if (ammo.TopArmorAttack || ammo.IsTopArmorArmorAttack) traits.push({ label: 'TOP', variant: 'warn', title: 'Top Attack' });
  if (ammo.LaserGuided) traits.push({ label: 'LSR', variant: 'accent', title: 'Laser Guided' });
  if (ammo.GenerateSmoke) traits.push({ label: 'SMK', title: 'Generates Smoke' });
  if (ammo.CanBeIntercepted) traits.push({ label: 'APS', title: 'Vulnerable to Active Protection Systems' });
  if (ammo.NoDamageFalloff) traits.push({ label: 'NO-FALL', title: 'No Damage Falloff' });
  if (ammo.IgnoreCover > 0) traits.push({ label: 'IGN-COV', title: 'Ignores Cover' });
  if (ammo.Airburst) traits.push({ label: 'AIRBST', title: 'Airburst' });
  if (ammo.CanReaquire) traits.push({ label: 'REACQ', variant: 'accent', title: 'Can Reacquire Target' });
  if (ammo.CanBeTargeted) traits.push({ label: 'TGTABLE', variant: 'warn', title: 'Targetable by Point Defense' });
  if (ammo.OverpressureRadius > 0) traits.push({ label: 'OVPR', variant: 'warn', title: `Overpressure ${ammo.OverpressureRadius}m` });
  if (ammo.RadioFuseDistance > 0) traits.push({ label: 'PROX', title: `Proximity Fuse ${ammo.RadioFuseDistance}m` });
  if (ammo.DamageOverTimeDuration > 0) traits.push({ label: 'FIRE', variant: 'fire', title: `Fire Duration ${ammo.DamageOverTimeDuration}s` });

  return (
    <>
      <tr
        class={`border-b border-[rgba(51,51,51,0.3)] last:border-b-0 transition-colors cursor-pointer ${expanded.value ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'}`}
        onClick$={() => (expanded.value = !expanded.value)}
      >
        {/* Name + icon with quantity prefix + hover tooltip */}
        <td class="px-4 py-2.5 text-left overflow-hidden">
          <SimpleTooltip text={[
            ammo.HUDName,
            '',
            `DMG ${ammo.Damage}${ammo.StressDamage > 0 ? `  STRESS ${ammo.StressDamage}` : ''}`,
            (penClose > 0 || penFar > 0) ? `PEN ${penClose === penFar ? penClose : `${penClose}–${penFar}`}${armorType ? ` (${armorType.label})` : ''}` : null,
            range > 0 ? `RNG ${minRange > 0 ? `${minRange}m – ` : ''}${range}m` : null,
            lowAlt > 0 ? `LOW ALT ${lowAlt}m` : null,
            highAlt > 0 ? `HIGH ALT ${highAlt}m` : null,
            ammo.MuzzleVelocity > 0 ? `VEL ${Math.round(ammo.MuzzleVelocity)} m/s` : null,
            '',
            trajectoryLabel ? `Trajectory: ${trajectoryLabel}` : null,
            seekerLabel ? `Seeker: ${seekerLabel}` : null,
            ...traits.map(tr => tr.title || tr.label),
          ].filter(Boolean).join('\n')}>
            <div class="flex items-center gap-2 min-w-0 pr-2">
              <span class="text-[var(--text-dim)] text-xs shrink-0 w-5 text-right whitespace-nowrap">{quantity}×</span>
              {ammoIcon && <div class="shrink-0 flex items-center justify-center w-[18px]"><GameIcon src={ammoIcon} size={18} variant="white" alt={ammo.HUDName} /></div>}
              <span class="text-[var(--text)] truncate w-40 shrink-0">{ammo.HUDName}</span>
              <div class="flex flex-wrap gap-1 shrink-0 ml-1">
                {trajectoryLabel && <TraitPill label={trajectoryLabel} title={trajectoryDesc || 'Trajectory'} />}
                {seekerLabel && <TraitPill label={seekerLabel} variant="accent" title={seekerDesc || 'Seeker'} />}
              </div>
            </div>
          </SimpleTooltip>
        </td>
        {/* Armor type */}
        <td class="px-2 py-2.5 text-center">
          {armorType ? (
            <span class={`font-semibold ${armorType.color}`}>{armorType.label}</span>
          ) : (
            <span class="text-[var(--text-dim)]">—</span>
          )}
        </td>
        {/* Targets */}
        <td class="px-2 py-2.5">
          <div class="flex justify-center gap-0.5">
            {targetBits.map(bit => (
              <GameIcon key={bit} src={TARGET_ICONS[bit]} size={18} variant="white" alt="" />
            ))}
          </div>
        </td>
        {/* Damage — for infantry weapons we surface DPS (rounds-per-min × per-round
            damage / 60) as the primary value and tuck the raw per-round damage below
            as a caption so the table column width stays consistent. */}
        <td class="px-2 py-2.5 text-right text-[var(--text)]">
          {ammo.Damage > 0 ? (
            weaponRpm > 0 ? (
              <SimpleTooltip text={`${(weaponRpm / 60 * ammo.Damage).toFixed(2)} dps · ${ammo.Damage} per round at ${Math.round(weaponRpm)} rpm`}>
                <div class="leading-tight">
                  <div class="font-semibold">{(weaponRpm / 60 * ammo.Damage).toFixed(2)}</div>
                  <div class="text-[10px] text-[var(--text-dim)] font-normal">{ammo.Damage}/rd</div>
                </div>
              </SimpleTooltip>
            ) : (
              ammo.Damage
            )
          ) : '—'}
        </td>
        {/* Stress */}
        <td class="px-2 py-2.5 text-right text-[var(--text)]">
          {ammo.StressDamage > 0 ? ammo.StressDamage : '—'}
        </td>
        {/* Pen (close – far) */}
        <td class="px-2 py-2.5 text-right text-[var(--text)] whitespace-nowrap">
          {penClose > 0 || penFar > 0
            ? penClose === penFar
              ? penClose
              : `${penClose} – ${penFar}`
            : '—'}
        </td>
        {/* Range (min – max) */}
        <td class="px-2 py-2.5 text-right text-[var(--text)] whitespace-nowrap">
          {range > 0 ? `${minRange}m – ${range}m` : '—'}
        </td>
        {/* Low Alt (conditional column) */}
        {showLowAlt && (
          <td class="px-2 py-2.5 text-right text-[var(--text)]">
            {lowAlt > 0 ? (
              <div>
                <span>{lowAlt}m</span>
                {radarLowAltMod > 0 && radarLowAltMod !== 1 && (
                  <div class="text-[10px] text-[var(--accent)]">{Math.round(lowAlt * radarLowAltMod)}m</div>
                )}
              </div>
            ) : '—'}
          </td>
        )}
        {/* High Alt (conditional column) */}
        {showHighAlt && (
          <td class="px-2 py-2.5 text-right text-[var(--text)]">
            {highAlt > 0 ? (
              <div>
                <span>{highAlt}m</span>
                {radarHighAltMod > 0 && radarHighAltMod !== 1 && (
                  <div class="text-[10px] text-[var(--accent)]">{Math.round(highAlt * radarHighAltMod)}m</div>
                )}
              </div>
            ) : '—'}
          </td>
        )}
        {/* Velocity */}
        <td class="px-2 py-2.5 text-right text-[var(--text)]">
          {ammo.MuzzleVelocity > 0 ? `${Math.round(ammo.MuzzleVelocity)}` : '—'}
        </td>
        {/* Traits */}
        <td class="px-2 py-2.5 text-left">
          <div class="flex flex-wrap gap-1">
            {traits.map(t => (
              <TraitPill key={t.label} label={t.label} variant={t.variant} title={t.title} />
            ))}
          </div>
        </td>
        {/* Expand arrow */}
        <td class="px-1 py-2.5 text-center">
          <span class={`text-[var(--text-dim)] text-xs inline-block transition-transform ${expanded.value ? 'rotate-180' : ''}`}>▾</span>
        </td>
      </tr>

      {/* Expanded detail row — organized groups */}
      {expanded.value && (
        <tr class="bg-[rgba(26,26,26,0.4)] border-b border-[rgba(51,51,51,0.3)]">
          <td colSpan={colSpanTotal} class="px-4 py-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">

              {/* Group: Damage & Penetration */}
              <div class="border border-[rgba(51,51,51,0.3)] bg-[var(--bg)] p-3 shadow-inner">
                <p class="text-[10px] uppercase tracking-[0.2em] text-[var(--text-dim)] mb-2 font-semibold">Damage & Penetration</p>
                <div class="flex flex-col gap-1.5">
                  <AmmoStat label="Damage" value={ammo.Damage} />
                  <AmmoStat label="Stress Damage" value={ammo.StressDamage} />
                  <AmmoStat label="Pen (close)" value={ammo.PenetrationAtMinRange} />
                  <AmmoStat label="Pen (far)" value={ammo.PenetrationAtGroundRange} />
                  <AmmoStat label="AOE (HP)" value={ammo.HealthAOERadius > 0 ? `${ammo.HealthAOERadius}m` : '—'} />
                  <AmmoStat label="AOE (Stress)" value={ammo.StressAOERadius > 0 ? `${ammo.StressAOERadius}m` : '—'} />
                  {ammo.OverpressureRadius > 0 && <AmmoStat label="Overpressure" value={`${ammo.OverpressureRadius}m`} />}
                  {ammo.RadioFuseDistance > 0 && <AmmoStat label="Proximity Fuse" value={`${ammo.RadioFuseDistance}m`} />}
                  <AmmoStat label="Crit Multiplier" value={ammo.CriticMultiplier || '—'} />
                  <AmmoStat label="HUD Multiplier" value={ammo.HUDMultiplier || '—'} />
                </div>
              </div>

              {/* Group: Range & Trajectory */}
              <div class="border border-[rgba(51,51,51,0.3)] bg-[var(--bg)] p-3 shadow-inner">
                <p class="text-[10px] uppercase tracking-[0.2em] text-[var(--text-dim)] mb-2 font-semibold">Range & Trajectory</p>
                <div class="flex flex-col gap-1.5">
                  <AmmoStat label="Trajectory" value={t(i18n,trajectoryTypeToString(ammo.TrajectoryType))} />
                  <AmmoStat label="Ground Range" value={range > 0 ? `${range}m` : '—'} />
                  <AmmoStat label="Min Range" value={minRange > 0 ? `${minRange}m` : '—'} />
                  {ammo.LowAltRange > 0 && <AmmoStat label="Low Alt Range" value={`${lowAlt}m`} />}
                  {ammo.HighAltRange > 0 && <AmmoStat label="High Alt Range" value={`${highAlt}m`} />}
                  <AmmoStat label="Muzzle Velocity" value={ammo.MuzzleVelocity > 0 ? `${Math.round(ammo.MuzzleVelocity)} m/s` : '—'} />
                  <AmmoStat label="Max Speed" value={ammo.MaxSpeed > 0 ? `${Math.round(ammo.MaxSpeed)} m/s` : '—'} />
                  <AmmoStat label="Dispersion H" value={ammo.DispersionHorizontalRadius > 0 ? `${ammo.DispersionHorizontalRadius}m` : '—'} />
                  <AmmoStat label="Dispersion V" value={ammo.DispersionVerticalRadius > 0 ? `${ammo.DispersionVerticalRadius}m` : '—'} />
                  {ammo.SeekerAngle > 0 && <AmmoStat label="Seeker Angle" value={`${ammo.SeekerAngle}°`} />}
                  {ammo.MaxSeekerDistance > 0 && <AmmoStat label="Seeker Range" value={`${Math.round(ammo.MaxSeekerDistance * 2)}m`} />}
                  {ammo.RotationSpeed > 0 && <AmmoStat label="Turn Rate" value={`${ammo.RotationSpeed}°/s`} />}
                  {ammo.BurnTime > 0 && <AmmoStat label="Burn Time" value={`${ammo.BurnTime}s`} />}
                </div>
              </div>

              {/* Group: Supply & Traits */}
              <div class="border border-[rgba(51,51,51,0.3)] bg-[var(--bg)] p-3 shadow-inner">
                <p class="text-[10px] uppercase tracking-[0.2em] text-[var(--text-dim)] mb-2 font-semibold">Supply & Traits</p>
                <div class="flex flex-col gap-1.5">
                  <AmmoStat label="Resupply Time" value={ammo.ResupplyTime > 0 ? `${ammo.ResupplyTime}s` : '—'} />
                  {ammo.AimStartDelay > 0 && <AmmoStat label="Aim Delay" value={`${ammo.AimStartDelay}s`} />}
                  {ammo.MainEngineIgnitionDelay > 0 && <AmmoStat label="Ignition Delay" value={`${ammo.MainEngineIgnitionDelay}s`} />}
                  {ammo.DamageOverTimeDuration > 0 && <AmmoStat label="Fire Duration" value={`${ammo.DamageOverTimeDuration}s`} />}
                  {ammo.CanReaquire && <AmmoStat label="Can Reacquire" value="Yes" />}
                  {ammo.CanBeTargeted && <AmmoStat label="Targetable" value="Yes" />}
                </div>
                {(traits.length > 0 || trajectoryLabel || seekerLabel) && (
                  <div class="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-[rgba(51,51,51,0.3)]">
                    {trajectoryLabel && <TraitPill label={trajectoryLabel} title={trajectoryDesc || 'Trajectory'} />}
                    {seekerLabel && <TraitPill label={seekerLabel} variant="accent" title={seekerDesc || 'Seeker'} />}
                    {traits.map(t => (
                      <TraitPill key={t.label} label={t.label} variant={t.variant} title={t.title} />
                    ))}
                  </div>
                )}
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  );
});

/* ── Micro components ──────────────────────────────────────────── */

const AmmoStat = component$<{ label: string; value: number | string }>(({ label, value }) => (
  <div class="flex justify-between">
    <span class="text-[var(--text-dim)]">{label}</span>
    <span class="text-[var(--text)]">{value}</span>
  </div>
));

const TRAIT_VARIANT_CLASSES: Record<string, string> = {
  default: 'bg-[var(--tag)] text-[var(--tag-text)]',
  accent: 'bg-[var(--accent)]/20 text-[var(--accent)]',
  warn: 'bg-[#e8a050]/20 text-[#e8a050]',
  fire: 'bg-[#e05040]/20 text-[#e05040]',
};

const TraitPill = component$<{ label: string; variant?: string; title?: string }>(({ label, variant, title }) => {
  const pill = (
    <span 
      class={`px-1 py-0.5 text-[9px] leading-none font-mono uppercase tracking-wider rounded-sm ${TRAIT_VARIANT_CLASSES[variant || 'default'] || TRAIT_VARIANT_CLASSES.default}`}
    >
      {label}
    </span>
  );
  return title ? <SimpleTooltip text={title}>{pill}</SimpleTooltip> : pill;
});
