import { component$, useSignal } from '@builder.io/qwik';
import { GameIcon } from '~/components/GameIcon';
import { UtilIconPaths, toWeaponIconPath, toAmmunitionIconPath } from '~/lib/iconPaths';
import type { UnitDetailWeapon, UnitDetailAmmo } from '~/routes/arsenal/[unitid]';

type Props = { weapons: UnitDetailWeapon[]; unitId: number };

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

export const UnitWeaponsPanel = component$<Props>(({ weapons }) => {
  const merged = mergeWeapons(weapons);
  const { hasLowAlt, hasHighAlt } = hasAnyAltRange(weapons);

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
};

const WeaponSection = component$<WeaponSectionProps>(({ entry, count, isMerged, showLowAlt, showHighAlt }) => {
  const { weapon, turret, ammunition } = entry;
  const weaponIcon = weapon.HUDIcon ? toWeaponIconPath(weapon.HUDIcon) : null;

  const mag = weapon.MagazineSize;
  const reloadMin = weapon.MagazineReloadTimeMin;
  const reloadMax = weapon.MagazineReloadTimeMax;
  const aimMin = weapon.AimTimeMin;
  const aimMax = weapon.AimTimeMax;
  const reload = reloadMin === reloadMax ? `${reloadMin}s` : `${reloadMin}–${reloadMax}s`;
  const aim = aimMin === aimMax ? `${aimMin}s` : `${aimMin}–${aimMax}s`;

  return (
    <div class="border border-[var(--border)] bg-[var(--bg-raised)]">
      {/* Weapon header bar */}
      <div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
        {weaponIcon && <GameIcon src={weaponIcon} size={24} variant="white" alt={weapon.Name} />}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-base font-semibold text-[var(--text)] truncate">
              {weapon.HUDName || weapon.Name}
            </p>
            {count > 1 && (
              <span
                class="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[var(--accent)]/20 text-[var(--accent)] rounded"
                title={isMerged ? `${count} combined from multiple mounts` : `${count} instances`}
              >
                {count}×
              </span>
            )}
          </div>
          {turret && (
            <p class="text-xs font-mono text-[var(--text-dim)]">
              {turret.FullRotation ? '360°' : `${turret.LeftHorizontalAngle}°–${turret.RightHorizontalAngle}°`}
              {' · '}{turret.HorizontalRotationSpeed}°/s
            </p>
          )}
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
        </div>

        {/* Trait badges */}
        <div class="flex gap-1 shrink-0">
          {weapon.AutoLoaded && <TraitPill label="AUTO" />}
          {weapon.IsVerticalLauncher && <TraitPill label="VLS" />}
          {!weapon.CanShootOnTheMove && <TraitPill label="STATIC" />}
          {weapon.MultiTargetTracking > 1 && <TraitPill label={`MTT ×${weapon.MultiTargetTracking}`} />}
          {weapon.SimultaneousTracking > 1 && <TraitPill label={`SIM ×${weapon.SimultaneousTracking}`} />}
        </div>
      </div>

      {/* Ammo table */}
      {ammunition.length > 0 && (
        <div class="overflow-x-auto">
          <table class="w-full text-sm font-mono" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col />
              <col style={{ width: '55px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '50px' }} />
              <col style={{ width: '50px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '105px' }} />
              {showLowAlt && <col style={{ width: '70px' }} />}
              {showHighAlt && <col style={{ width: '70px' }} />}
              <col style={{ width: '60px' }} />
              <col style={{ width: '95px' }} />
              <col style={{ width: '24px' }} />
            </colgroup>
            <thead>
              <tr class="text-[11px] uppercase tracking-widest text-[var(--text-dim)] border-b border-[var(--border)]">
                <th class="text-left px-4 py-2 font-normal">Ammunition</th>
                <th class="text-center px-2 py-2 font-normal">Type</th>
                <th class="text-center px-2 py-2 font-normal">Targets</th>
                <th class="text-right px-2 py-2 font-normal">Dmg</th>
                <th class="text-right px-2 py-2 font-normal">Stress</th>
                <th class="text-right px-2 py-2 font-normal">Pen</th>
                <th class="text-right px-2 py-2 font-normal">Range</th>
                {showLowAlt && <th class="text-right px-2 py-2 font-normal whitespace-nowrap">Low Alt</th>}
                {showHighAlt && <th class="text-right px-2 py-2 font-normal whitespace-nowrap">High Alt</th>}
                <th class="text-right px-2 py-2 font-normal">Velocity</th>
                <th class="text-left px-2 py-2 font-normal">Traits</th>
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
};

const AmmoTableRow = component$<AmmoTableRowProps>(({ ammo, quantity, showLowAlt, showHighAlt, colSpanTotal }) => {
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
  const traits: string[] = [];
  if (ammo.TopArmorAttack) traits.push('TOP');
  if (ammo.LaserGuided) traits.push('LGM');
  if (ammo.GenerateSmoke) traits.push('SMK');
  if (ammo.Seeker > 0) traits.push('SEEKER');
  if (ammo.CanBeIntercepted) traits.push('APS-V');

  return (
    <>
      <tr
        class="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
        onClick$={() => (expanded.value = !expanded.value)}
      >
        {/* Name + icon with quantity prefix */}
        <td class="px-4 py-2.5 text-left overflow-hidden">
          <div class="flex items-center gap-1.5">
            <span class="text-[var(--text-dim)] text-xs shrink-0">{quantity}×</span>
            {ammoIcon && <GameIcon src={ammoIcon} size={18} variant="white" alt={ammo.Name} />}
            <span class="text-[var(--text)] truncate">{ammo.HUDName || ammo.Name}</span>
          </div>
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
        {/* Damage */}
        <td class="px-2 py-2.5 text-right text-[var(--text)]">
          {ammo.Damage > 0 ? ammo.Damage : '—'}
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
            {lowAlt > 0 ? `${lowAlt}m` : '—'}
          </td>
        )}
        {/* High Alt (conditional column) */}
        {showHighAlt && (
          <td class="px-2 py-2.5 text-right text-[var(--text)]">
            {highAlt > 0 ? `${highAlt}m` : '—'}
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
              <TraitPill key={t} label={t} />
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
        <tr class="bg-[var(--bg)]/60">
          <td colSpan={colSpanTotal} class="px-4 py-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">

              {/* Group: Damage & Penetration */}
              <div class="border border-[var(--border)] bg-[var(--bg-raised)]/50 p-3">
                <p class="text-[10px] uppercase tracking-[0.2em] text-[var(--text-dim)] mb-2 font-semibold">Damage & Penetration</p>
                <div class="flex flex-col gap-1.5">
                  <AmmoStat label="Damage" value={ammo.Damage} />
                  <AmmoStat label="Stress Damage" value={ammo.StressDamage} />
                  <AmmoStat label="Pen (close)" value={ammo.PenetrationAtMinRange} />
                  <AmmoStat label="Pen (far)" value={ammo.PenetrationAtGroundRange} />
                  <AmmoStat label="AOE (HP)" value={ammo.HealthAOERadius > 0 ? `${ammo.HealthAOERadius}m` : '—'} />
                  <AmmoStat label="AOE (Stress)" value={ammo.StressAOERadius > 0 ? `${ammo.StressAOERadius}m` : '—'} />
                  <AmmoStat label="Crit Multiplier" value={ammo.CriticMultiplier || '—'} />
                  <AmmoStat label="HUD Multiplier" value={ammo.HUDMultiplier || '—'} />
                </div>
              </div>

              {/* Group: Range & Trajectory */}
              <div class="border border-[var(--border)] bg-[var(--bg-raised)]/50 p-3">
                <p class="text-[10px] uppercase tracking-[0.2em] text-[var(--text-dim)] mb-2 font-semibold">Range & Trajectory</p>
                <div class="flex flex-col gap-1.5">
                  <AmmoStat label="Ground Range" value={range > 0 ? `${range}m` : '—'} />
                  <AmmoStat label="Min Range" value={minRange > 0 ? `${minRange}m` : '—'} />
                  {ammo.LowAltRange > 0 && <AmmoStat label="Low Alt Range" value={`${lowAlt}m`} />}
                  {ammo.HighAltRange > 0 && <AmmoStat label="High Alt Range" value={`${highAlt}m`} />}
                  <AmmoStat label="Muzzle Velocity" value={ammo.MuzzleVelocity > 0 ? `${Math.round(ammo.MuzzleVelocity)} m/s` : '—'} />
                  <AmmoStat label="Max Speed" value={ammo.MaxSpeed > 0 ? `${Math.round(ammo.MaxSpeed)} m/s` : '—'} />
                  <AmmoStat label="Dispersion H" value={ammo.DispersionHorizontalRadius > 0 ? `${ammo.DispersionHorizontalRadius}m` : '—'} />
                  <AmmoStat label="Dispersion V" value={ammo.DispersionVerticalRadius > 0 ? `${ammo.DispersionVerticalRadius}m` : '—'} />
                  {ammo.SeekerAngle > 0 && <AmmoStat label="Seeker Angle" value={`${ammo.SeekerAngle}°`} />}
                </div>
              </div>

              {/* Group: Supply & Traits */}
              <div class="border border-[var(--border)] bg-[var(--bg-raised)]/50 p-3">
                <p class="text-[10px] uppercase tracking-[0.2em] text-[var(--text-dim)] mb-2 font-semibold">Supply & Traits</p>
                <div class="flex flex-col gap-1.5">
                  <AmmoStat label="Supply Cost" value={ammo.SupplyCost > 0 ? ammo.SupplyCost : '—'} />
                  <AmmoStat label="Resupply Time" value={ammo.ResupplyTime > 0 ? `${ammo.ResupplyTime}s` : '—'} />
                </div>
                {traits.length > 0 && (
                  <div class="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-[var(--border)]">
                    {ammo.TopArmorAttack && <TraitPill label="TOP ATTACK" />}
                    {ammo.LaserGuided && <TraitPill label="LASER GUIDED" />}
                    {ammo.GenerateSmoke && <TraitPill label="SMOKE" />}
                    {ammo.Seeker > 0 && <TraitPill label="SEEKER" />}
                    {ammo.CanBeIntercepted && <TraitPill label="APS VULNERABLE" />}
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

const TraitPill = component$<{ label: string }>(({ label }) => (
  <span class="px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-[var(--tag)] text-[var(--tag-text)]">
    {label}
  </span>
));
