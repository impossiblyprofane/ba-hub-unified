import { component$ } from '@builder.io/qwik';
import { GameIcon } from '~/components/GameIcon';
import { RichTooltip, TipRow } from '~/components/ui/RichTooltip';
import { UtilIconPaths } from '~/lib/iconPaths';
import { useI18n, t } from '~/lib/i18n';
import type { UnitDetailAbility } from '~/lib/graphql-types';

type Props = { abilities: UnitDetailAbility[]; compact?: boolean; fill?: boolean };

type AbilityInfo = {
  icon: string;
  label: string;
  stats: Array<{ key: string; value: string }>;
  tooltipTitle: string;
  tooltipDesc: string;
  tooltipRows: Array<{ label: string; value: string }>;
};

type AbilityRowSpec = { signature: string; info: AbilityInfo };

/**
 * Abilities panel — each ability category shown as a row with icon, label,
 * key stats. A single ability record can cover multiple categories (e.g.
 * "Laser Smoke x2" is both Laser Designator AND Smoke), so we expand each
 * record into one row per category. The resolver guarantees at most one
 * ability per category (coin-sorter slot model), so no further dedupe needed.
 */
export const UnitAbilitiesPanel = component$<Props>(({ abilities, compact, fill }) => {
  const i18n = useI18n();
  const rows = abilities.flatMap(buildAbilityRows);
  if (rows.length === 0) return null;

  return (
    <div
      class={`p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] ${fill ? 'h-full flex flex-col' : ''}`}
    >
      <p class={`font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] ${compact ? 'text-[9px] px-2 py-2' : 'text-[10px] px-3 py-2'} border-b border-[rgba(51,51,51,0.3)]`}>
        {t(i18n, 'unitDetail.panel.abilities')}
      </p>
      <div class={`flex flex-col ${compact ? 'gap-1.5' : 'gap-2'} ${fill ? 'flex-1 overflow-y-auto' : ''}`}>
        {rows.map(row => (
          <AbilityRow key={row.signature} info={row.info} compact={compact} />
        ))}
      </div>
    </div>
  );
});

const AbilityRow = component$<{ info: AbilityInfo; compact?: boolean }>(({ info, compact }) => {
  return (
    <RichTooltip>
      <div class={`flex items-start ${compact ? 'gap-1.5 p-1' : 'gap-2 p-1.5'} bg-[rgba(26,26,26,0.4)] cursor-help`}>
        <GameIcon src={info.icon} size={compact ? 16 : 20} variant="accent" alt={info.label} class="mt-0.5 shrink-0" />
        <div class="flex-1 min-w-0">
          <p class={`${compact ? 'text-[11px]' : 'text-xs'} font-semibold text-[var(--text)]`}>{info.label}</p>
          {info.stats.length > 0 && (
            <div class={`flex flex-wrap ${compact ? 'gap-x-2' : 'gap-x-3'} gap-y-0.5 mt-0.5`}>
              {info.stats.map(s => (
                <span key={s.key} class={`${compact ? 'text-[9px]' : 'text-[10px]'} font-mono text-[var(--text-dim)]`}>
                  {s.key}: <span class="text-[var(--text)]">{s.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div q:slot="tooltip" class="space-y-2">
        <div class="font-bold text-[var(--accent)]">{info.tooltipTitle}</div>
        <div class="text-[var(--text-dim)]">{info.tooltipDesc}</div>
        {info.tooltipRows.length > 0 && (
          <div class="space-y-1 border-t border-[var(--accent)]/30 pt-2">
            {info.tooltipRows.map(r => (
              <TipRow key={r.label} label={r.label} value={r.value} />
            ))}
          </div>
        )}
      </div>
    </RichTooltip>
  );
});

function buildAbilityRows(a: UnitDetailAbility): AbilityRowSpec[] {
  const rows: AbilityRowSpec[] = [];

  if (a.IsLaserDesignator) {
    rows.push({
      signature: `laser:${a.LaserMaxRange}:${a.LaserUsableInMove}`,
      info: {
        icon: UtilIconPaths.ABILITY_LASER_DESIGNATION,
        label: 'Laser Designator',
        stats: [{ key: 'Range', value: `${Math.round(a.LaserMaxRange * 2)}m` }],
        tooltipTitle: 'Laser Designator',
        tooltipDesc: 'Guides laser-guided munitions to the target',
        tooltipRows: [
          { label: 'Range', value: `${Math.round(a.LaserMaxRange * 2)}m` },
          { label: 'Usage', value: a.LaserUsableInMove ? 'Can designate while moving' : 'Must be stationary' },
        ],
      },
    });
  }

  if (a.IsRadar) {
    const modeLabel = a.IsRadarStatic ? 'STATIC' : 'MOBILE';
    rows.push({
      signature: `radar:${a.IsRadarStatic}:${a.RadarLowAltOpticsModifier}:${a.RadarHighAltOpticsModifier}`,
      info: {
        icon: UtilIconPaths.ABILITY_RADAR,
        label: `Radar (${modeLabel})`,
        stats: [
          { key: 'Low', value: `×${a.RadarLowAltOpticsModifier}` },
          { key: 'High', value: `×${a.RadarHighAltOpticsModifier}` },
        ],
        tooltipTitle: `Radar — ${modeLabel}`,
        tooltipDesc: a.IsRadarStatic
          ? 'Enhances aerial detection range; unit must be stationary'
          : 'Enhances aerial detection range while moving',
        tooltipRows: [
          { label: 'Low Alt Optics', value: `×${a.RadarLowAltOpticsModifier}` },
          { label: 'High Alt Optics', value: `×${a.RadarHighAltOpticsModifier}` },
          ...(a.RadarLowAltWeaponRangeModifier > 0 && a.RadarLowAltWeaponRangeModifier !== 1
            ? [{ label: 'Low Alt Wpn Range', value: `×${a.RadarLowAltWeaponRangeModifier}` }] : []),
          ...(a.RadarHighAltWeaponRangeModifier > 0 && a.RadarHighAltWeaponRangeModifier !== 1
            ? [{ label: 'High Alt Wpn Range', value: `×${a.RadarHighAltWeaponRangeModifier}` }] : []),
          ...(a.RadarSwitchCooldown > 0
            ? [{ label: 'Toggle Cooldown', value: `${a.RadarSwitchCooldown}s` }] : []),
        ],
      },
    });
  }

  if (a.IsAPS) {
    rows.push({
      signature: `aps:${a.APSQuantity}:${a.APSCooldown}:${a.APSHitboxProportion}`,
      info: {
        icon: UtilIconPaths.ABILITY_APS,
        label: 'Active Protection',
        stats: [{ key: 'Charges', value: String(a.APSQuantity) }],
        tooltipTitle: 'Active Protection System',
        tooltipDesc: 'Intercepts incoming projectiles before impact',
        tooltipRows: [
          { label: 'Charges', value: String(a.APSQuantity) },
          { label: 'Cooldown', value: `${a.APSCooldown}s` },
          { label: 'Coverage', value: `${Math.round(a.APSHitboxProportion * 100)}% hitbox` },
          ...(a.APSSupplyCost > 0 ? [{ label: 'Supply Cost', value: String(a.APSSupplyCost) }] : []),
          ...(a.APSResupplyTime > 0 ? [{ label: 'Resupply Time', value: `${a.APSResupplyTime}s` }] : []),
        ],
      },
    });
  }

  if (a.IsSmoke) {
    rows.push({
      signature: `smoke:${a.SmokeAmmunitionQuantity}:${a.SmokeCooldown}`,
      info: {
        icon: UtilIconPaths.ABILITY_SMOKE,
        label: 'Smoke Screen',
        stats: [{ key: 'Rounds', value: String(a.SmokeAmmunitionQuantity) }],
        tooltipTitle: 'Smoke Screen',
        tooltipDesc: 'Deploys smoke screens for concealment',
        tooltipRows: [
          { label: 'Rounds', value: String(a.SmokeAmmunitionQuantity) },
          { label: 'Cooldown', value: `${a.SmokeCooldown}s` },
          { label: 'Effect', value: 'Blocks line of sight and reduces accuracy' },
        ],
      },
    });
  }

  if (a.IsInfantrySprint) {
    rows.push({
      signature: `sprint:${a.SprintDuration}:${a.SprintCooldown}`,
      info: {
        icon: UtilIconPaths.ABILITY_SPRINT,
        label: 'Sprint',
        stats: [{ key: 'Dur', value: `${a.SprintDuration}s` }],
        tooltipTitle: 'Sprint',
        tooltipDesc: 'Temporarily increases movement speed',
        tooltipRows: [
          { label: 'Duration', value: `${a.SprintDuration}s` },
          { label: 'Cooldown', value: `${a.SprintCooldown}s` },
        ],
      },
    });
  }

  if (a.IsDecoy) {
    const accPct = a.DecoyAccuracyMultiplier > 0
      ? `${Math.round((1 - a.DecoyAccuracyMultiplier) * 100)}%`
      : null;
    rows.push({
      signature: `decoy:${a.DecoyQuantity}:${a.DecoyDuration}:${a.DecoyCooldown}:${a.DecoyAccuracyMultiplier}`,
      info: {
        icon: UtilIconPaths.ABILITY_FLARES,
        label: 'Decoy / Flares',
        stats: [{ key: 'Qty', value: String(a.DecoyQuantity) }],
        tooltipTitle: 'Decoy / Flares',
        tooltipDesc: 'Deploys countermeasures to confuse incoming missiles',
        tooltipRows: [
          { label: 'Charges', value: String(a.DecoyQuantity) },
          { label: 'Duration', value: `${a.DecoyDuration}s` },
          { label: 'Cooldown', value: `${a.DecoyCooldown}s` },
          ...(accPct ? [{ label: 'Accuracy Reduction', value: accPct }] : []),
          ...(a.DecoySupplyCost > 0 ? [{ label: 'Supply Cost', value: String(a.DecoySupplyCost) }] : []),
          ...(a.DecoyResupplyTime > 0 ? [{ label: 'Resupply Time', value: `${a.DecoyResupplyTime}s` }] : []),
        ],
      },
    });
  }

  if (a.ECMAccuracyMultiplier > 0 && a.ECMAccuracyMultiplier < 1) {
    const pct = Math.round((1 - a.ECMAccuracyMultiplier) * 100);
    rows.push({
      signature: `ecm:${a.ECMAccuracyMultiplier}`,
      info: {
        icon: UtilIconPaths.TRAIT_ECM,
        label: 'ECM',
        stats: [{ key: 'Reduction', value: `${pct}%` }],
        tooltipTitle: 'Electronic Countermeasures',
        tooltipDesc: 'Reduces enemy weapon accuracy against this unit',
        tooltipRows: [
          { label: 'Accuracy Reduction', value: `${pct}%` },
          { label: 'Multiplier', value: `×${a.ECMAccuracyMultiplier}` },
        ],
      },
    });
  }

  return rows;
}
