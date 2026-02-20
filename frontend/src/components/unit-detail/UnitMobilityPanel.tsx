import { component$ } from '@builder.io/qwik';
import { GameIcon } from '~/components/GameIcon';
import { UtilIconPaths } from '~/lib/iconPaths';
import type { UnitDetailMobility, UnitDetailFlyPreset } from '~/routes/arsenal/[unitid]';

type Props = {
  mobility: UnitDetailMobility;
  flyPreset: UnitDetailFlyPreset | null;
  unitType: number;
  compact?: boolean;
  fill?: boolean;
};

export const UnitMobilityPanel = component$<Props>(({ mobility, flyPreset, unitType, compact, fill }) => {
  const isInfantry = unitType === 2;
  const isHelicopter = unitType === 8;
  const isAircraft = unitType === 16;

  const fwdIcon = isAircraft
    ? UtilIconPaths.MOBILITY_FORWARD_AIR
    : isHelicopter
      ? UtilIconPaths.MOBILITY_FORWARD_HELI
      : isInfantry
        ? UtilIconPaths.MOBILITY_FORWARD_INFANTRY
        : UtilIconPaths.MOBILITY_FORWARD_VEH;

  // Build stats array based on unit type
  const stats: Array<{ icon: string; label: string; value: string; unit: string; iconOnly?: boolean }> = [];

  if (isAircraft && flyPreset) {
    // Aircraft: speed = MaxSpeedRoad halved, afterburner uses flyPreset ratio
    stats.push({ icon: fwdIcon, label: 'Speed', value: `${Math.round(mobility.MaxSpeedRoad / 2)}`, unit: '' });
    if (mobility.LoiteringTime > 0) {
      stats.push({ icon: UtilIconPaths.MOBILITY_FUEL, label: 'Flight time', value: `${Math.round(mobility.LoiteringTime)}`, unit: 's' });
    }
    stats.push({ icon: UtilIconPaths.STAT_AGILITY_AIR, label: 'Turn rate', value: `${mobility.TurnRate}`, unit: '°/s' });
    if (mobility.IsAfterburner && flyPreset.AfterburnSpeed > 0) {
      const abSpeed = (Math.round((mobility.MaxSpeedRoad * (flyPreset.AfterburnSpeed / flyPreset.MaxSpeed)) / 10) * 10) / 2;
      stats.push({ icon: UtilIconPaths.TRAIT_AFTERBURNER, label: 'Afterburner speed', value: `${abSpeed}`, unit: '' });
      if (mobility.AfterBurningLoiteringTime > 0) {
        stats.push({ icon: UtilIconPaths.MOBILITY_FUEL, label: 'Afterburner time', value: `${Math.round(mobility.AfterBurningLoiteringTime)}`, unit: 's' });
      }
    }
  } else if (isHelicopter) {
    stats.push({ icon: fwdIcon, label: 'Speed', value: `${Math.round(mobility.MaxSpeedRoad)}`, unit: '' });
    stats.push({ icon: UtilIconPaths.STAT_AGILITY_HELI, label: 'Agility', value: `${mobility.Agility}`, unit: '' });
    stats.push({ icon: UtilIconPaths.STAT_AGILITY_HELI, label: 'Turn rate', value: `${mobility.TurnRate}`, unit: '°/s' });
    if (mobility.LoiteringTime > 0) {
      stats.push({ icon: UtilIconPaths.MOBILITY_FUEL, label: 'Flight time', value: `${Math.round(mobility.LoiteringTime)}`, unit: 's' });
    }
  } else {
    // Ground units
    stats.push({ icon: fwdIcon, label: 'Road speed', value: `${Math.round(mobility.MaxSpeedRoad)}`, unit: '' });
    if (!isInfantry) {
      stats.push({ icon: fwdIcon, label: 'Off-road', value: `${Math.round(mobility.MaxCrossCountrySpeed)}`, unit: '' });
    }
    if (!isInfantry && mobility.MaxSpeedReverse > 0) {
      stats.push({ icon: UtilIconPaths.MOBILITY_REVERSE_VEH, label: 'Reverse', value: `${Math.round(mobility.MaxSpeedReverse)}`, unit: '' });
    }
    if (mobility.MaxSpeedWater > 0) {
      stats.push({ icon: UtilIconPaths.TRAIT_AMPHIBIOUS, label: 'Water', value: `${Math.round(mobility.MaxSpeedWater)}`, unit: '' });
    }
  }
  if (mobility.IsAirDroppable) {
    stats.push({ icon: UtilIconPaths.TRAIT_AIRDROP, label: 'Air-droppable', value: '', unit: '', iconOnly: true });
  }

  // Determine columns: max 4, match count when <= 4
  const cols = Math.min(stats.length, 4);
  const gridClass = cols <= 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div
      class={`p-0 bg-gradient-to-b from-[var(--bg)] to-[var(--bg)]/70 ${fill ? 'h-full flex flex-col' : ''}`}
    >
      <p class={`font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] ${compact ? 'text-[9px] px-2 py-2' : 'text-[10px] px-3 py-2'} border-b border-[var(--border)]/30`}>
        Mobility — km/h
      </p>

      {compact ? (
        <div class={`flex flex-wrap gap-2 ${fill ? 'flex-1' : ''} content-start`}>
          {stats.map(s => (
            <div key={s.label} class="flex items-center gap-2 px-2 py-1 bg-[var(--bg)]/40" title={s.label}>
              <GameIcon src={s.icon} size={16} variant="white" alt={s.label} />
              {!s.iconOnly && (
                <span class="text-xs font-semibold text-[var(--text)]">
                  {s.value}
                  {s.unit && <span class="text-[10px] font-mono text-[var(--text-dim)] ml-0.5">{s.unit}</span>}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div class={`grid ${gridClass} gap-1.5`}>
          {stats.map(s => (
            <div key={s.label} class="flex flex-col items-center gap-1.5 p-3 bg-[var(--bg)]/40" title={s.label}>
              <GameIcon src={s.icon} size={s.iconOnly ? 28 : 26} variant="white" alt={s.label} />
              {!s.iconOnly && (
                <span class="text-base font-semibold text-[var(--text)]">
                  {s.value}
                  {s.unit && <span class="text-xs font-mono text-[var(--text-dim)] ml-0.5">{s.unit}</span>}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
