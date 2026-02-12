import { component$ } from '@builder.io/qwik';
import { GameIcon } from '~/components/GameIcon';
import { UtilIconPaths } from '~/lib/iconPaths';
import type { UnitDetailMobility, UnitDetailFlyPreset } from '~/routes/arsenal/[unitid]';

type Props = {
  mobility: UnitDetailMobility;
  flyPreset: UnitDetailFlyPreset | null;
  unitType: number;
};

export const UnitMobilityPanel = component$<Props>(({ mobility, flyPreset, unitType }) => {
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
  const stats: Array<{ icon: string; label: string; value: string; unit: string }> = [];

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

  // Determine columns: max 4, match count when <= 4
  const cols = Math.min(stats.length, 4);
  const gridClass = cols <= 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div class="border border-[var(--border)] bg-[var(--bg-raised)] p-4">
      <p class="text-[10px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] mb-3">
        Mobility — km/h
      </p>

      <div class={`grid ${gridClass} gap-1.5`}>
        {stats.map(s => (
          <div key={s.label} class="flex flex-col items-center gap-1.5 p-3 bg-[var(--bg)]/40" title={s.label}>
            <GameIcon src={s.icon} size={24} variant="white" alt={s.label} />
            <span class="text-base font-semibold text-[var(--text)]">
              {s.value}
              {s.unit && <span class="text-xs font-mono text-[var(--text-dim)] ml-0.5">{s.unit}</span>}
            </span>
          </div>
        ))}
      </div>

      {/* Trait pills */}
      {mobility.IsAirDroppable && (
        <div class="flex flex-wrap gap-1.5 mt-2">
          <TraitPill icon={UtilIconPaths.TRAIT_AIRDROP} label="DROP" tip="Air-droppable" />
        </div>
      )}
    </div>
  );
});

const TraitPill = component$<{ icon: string; label: string; tip: string }>(({ icon, label, tip }) => (
  <span
    class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[var(--tag)] text-[var(--tag-text)] text-[9px] font-mono uppercase tracking-wider"
    title={tip}
  >
    <GameIcon src={icon} size={11} variant="accent" alt={tip} />
    {label}
  </span>
));
