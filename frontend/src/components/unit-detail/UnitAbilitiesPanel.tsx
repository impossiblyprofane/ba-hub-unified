import { component$ } from '@builder.io/qwik';
import { GameIcon } from '~/components/GameIcon';
import { RichTooltip, TipRow } from '~/components/ui/RichTooltip';
import { UtilIconPaths } from '~/lib/iconPaths';
import type { UnitDetailAbility } from '~/routes/arsenal/[unitid]';

type Props = { abilities: UnitDetailAbility[] };

/**
 * Abilities panel — each ability shown as a row with icon, label, key stats.
 * Rich tooltips give full detailed breakdowns on hover.
 */
export const UnitAbilitiesPanel = component$<Props>(({ abilities }) => {
  // Filter out empty/placeholder abilities (no type flags set)
  const displayable = abilities.filter(a => isDisplayableAbility(a));
  if (displayable.length === 0) return null;

  return (
    <div class="border border-[var(--border)] bg-[var(--bg-raised)] p-4">
      <p class="text-[10px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] mb-3">
        Abilities
      </p>
      <div class="flex flex-col gap-2">
        {displayable.map(ability => (
          <AbilityRow key={ability.Id} ability={ability} />
        ))}
      </div>
    </div>
  );
});

const AbilityRow = component$<{ ability: UnitDetailAbility }>(({ ability }) => {
  const info = getAbilityDisplay(ability);

  return (
    <RichTooltip>
      <div class="flex items-start gap-2 p-2 bg-[var(--bg)]/40 cursor-help">
        <GameIcon src={info.icon} size={18} variant="accent" alt={info.label} class="mt-0.5 shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-xs font-semibold text-[var(--text)]">{info.label}</p>
          {info.stats.length > 0 && (
            <div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {info.stats.map(s => (
                <span key={s.key} class="text-[10px] font-mono text-[var(--text-dim)]">
                  {s.key}: <span class="text-[var(--text)]">{s.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Rich tooltip content */}
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

type AbilityInfo = {
  icon: string;
  label: string;
  stats: Array<{ key: string; value: string }>;
  tooltipTitle: string;
  tooltipDesc: string;
  tooltipRows: Array<{ label: string; value: string }>;
};

function getAbilityDisplay(a: UnitDetailAbility): AbilityInfo {
  if (a.IsLaserDesignator) {
    return {
      icon: UtilIconPaths.ABILITY_LASER_DESIGNATION,
      label: 'Laser Designator',
      stats: [
        { key: 'Range', value: `${Math.round(a.LaserMaxRange * 2)}m` },
      ],
      tooltipTitle: 'Laser Designator',
      tooltipDesc: 'Guides laser-guided munitions to the target',
      tooltipRows: [
        { label: 'Range', value: `${Math.round(a.LaserMaxRange * 2)}m` },
        { label: 'Usage', value: a.LaserUsableInMove ? 'Can designate while moving' : 'Must be stationary' },
      ],
    };
  }
  if (a.IsRadar) {
    return {
      icon: UtilIconPaths.ABILITY_RADAR,
      label: 'Radar',
      stats: [
        { key: 'Low', value: `×${a.RadarLowAltOpticsModifier}` },
        { key: 'High', value: `×${a.RadarHighAltOpticsModifier}` },
      ],
      tooltipTitle: 'Radar',
      tooltipDesc: 'Enhances aerial detection range',
      tooltipRows: [
        { label: 'Low Altitude', value: `+${Math.round((a.RadarLowAltOpticsModifier - 1) * 100)}% optics (×${a.RadarLowAltOpticsModifier})` },
        { label: 'High Altitude', value: `+${Math.round((a.RadarHighAltOpticsModifier - 1) * 100)}% optics (×${a.RadarHighAltOpticsModifier})` },
      ],
    };
  }
  if (a.IsAPS) {
    return {
      icon: UtilIconPaths.ABILITY_APS,
      label: 'Active Protection',
      stats: [
        { key: 'Charges', value: String(a.APSQuantity) },
      ],
      tooltipTitle: 'Active Protection System',
      tooltipDesc: 'Intercepts incoming projectiles before impact',
      tooltipRows: [
        { label: 'Charges', value: String(a.APSQuantity) },
        { label: 'Cooldown', value: `${a.APSCooldown}s` },
        { label: 'Coverage', value: `${Math.round(a.APSHitboxProportion * 100)}% hitbox` },
      ],
    };
  }
  if (a.IsSmoke) {
    return {
      icon: UtilIconPaths.ABILITY_SMOKE,
      label: 'Smoke Screen',
      stats: [
        { key: 'Rounds', value: String(a.SmokeAmmunitionQuantity) },
      ],
      tooltipTitle: 'Smoke Screen',
      tooltipDesc: 'Deploys smoke screens for concealment',
      tooltipRows: [
        { label: 'Rounds', value: String(a.SmokeAmmunitionQuantity) },
        { label: 'Cooldown', value: `${a.SmokeCooldown}s` },
        { label: 'Effect', value: 'Blocks line of sight and reduces accuracy' },
      ],
    };
  }
  if (a.IsInfantrySprint) {
    return {
      icon: UtilIconPaths.ABILITY_SPRINT,
      label: 'Sprint',
      stats: [
        { key: 'Dur', value: `${a.SprintDuration}s` },
      ],
      tooltipTitle: 'Sprint',
      tooltipDesc: 'Temporarily increases movement speed',
      tooltipRows: [
        { label: 'Duration', value: `${a.SprintDuration}s` },
        { label: 'Cooldown', value: `${a.SprintCooldown}s` },
      ],
    };
  }
  if (a.IsDecoy) {
    return {
      icon: UtilIconPaths.ABILITY_FLARES,
      label: 'Decoy / Flares',
      stats: [
        { key: 'Qty', value: String(a.DecoyQuantity) },
      ],
      tooltipTitle: 'Decoy / Flares',
      tooltipDesc: 'Deploys countermeasures to confuse incoming missiles',
      tooltipRows: [
        { label: 'Charges', value: String(a.DecoyQuantity) },
        { label: 'Duration', value: `${a.DecoyDuration}s` },
        { label: 'Cooldown', value: `${a.DecoyCooldown}s` },
      ],
    };
  }
  if (a.ECMAccuracyMultiplier > 0 && a.ECMAccuracyMultiplier < 1) {
    const pct = Math.round((1 - a.ECMAccuracyMultiplier) * 100);
    return {
      icon: UtilIconPaths.TRAIT_ECM,
      label: 'ECM',
      stats: [
        { key: 'Reduction', value: `${pct}%` },
      ],
      tooltipTitle: 'Electronic Countermeasures',
      tooltipDesc: 'Reduces enemy weapon accuracy against this unit',
      tooltipRows: [
        { label: 'Accuracy Reduction', value: `${pct}%` },
        { label: 'Multiplier', value: `×${a.ECMAccuracyMultiplier}` },
      ],
    };
  }
  return {
    icon: UtilIconPaths.STAT_VISIBLE,
    label: a.Name || 'Ability',
    stats: [],
    tooltipTitle: a.Name || 'Ability',
    tooltipDesc: '',
    tooltipRows: [],
  };
}

/** True if the ability has at least one meaningful type flag set */
function isDisplayableAbility(a: UnitDetailAbility): boolean {
  return (
    a.IsLaserDesignator ||
    a.IsRadar ||
    a.IsAPS ||
    a.IsSmoke ||
    a.IsInfantrySprint ||
    a.IsDecoy ||
    (a.ECMAccuracyMultiplier > 0 && a.ECMAccuracyMultiplier < 1)
  );
}
