import { component$ } from '@builder.io/qwik';
import { GameIcon } from '~/components/GameIcon';
import { UtilIconPaths } from '~/lib/iconPaths';
import type { UnitDetailSensor, UnitDetailAbility } from '~/routes/arsenal/[unitid]';

type Props = {
  sensors: UnitDetailSensor[];
  abilities: UnitDetailAbility[];
  compact?: boolean;
  fill?: boolean;
};

export const UnitSensorsPanel = component$<Props>(({ sensors, abilities, compact, fill }) => {
  const radar = abilities.find(a => a.IsRadar);
  const primary = sensors[0];
  if (!primary) return null;

  const ground = Math.round(primary.OpticsGround * 2);
  const lowAlt = Math.round(primary.OpticsLowAltitude * 2);
  const highAlt = Math.round(primary.OpticsHighAltitude * 2);

  const radarLow = radar ? Math.round(primary.OpticsLowAltitude * 2 * radar.RadarLowAltOpticsModifier) : null;
  const radarHigh = radar ? Math.round(primary.OpticsHighAltitude * 2 * radar.RadarHighAltOpticsModifier) : null;

  return (
    <div
      class={`border border-[var(--border)] bg-[var(--bg-raised)] p-0 ${fill ? 'h-full flex flex-col' : ''}`}
    >
      <p class={`font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] ${compact ? 'text-[9px] px-2 py-2' : 'text-[10px] px-3 py-2'} border-b border-[var(--border)]`}>
        Optics
      </p>

      {compact ? (
        <div class={`flex flex-wrap gap-2 ${fill ? 'flex-1' : ''} content-start`}>
          <HStatCell icon={UtilIconPaths.STAT_OPTICS} tooltip="Ground optics" value={`${ground}m`} />
          <HStatCell icon={UtilIconPaths.TRAIT_AIR_ALT_DOWN} tooltip="Low-altitude optics" value={`${lowAlt}m`} />
          <HStatCell icon={UtilIconPaths.TRAIT_AIR_ALT_UP} tooltip="High-altitude optics" value={`${highAlt}m`} />
          {radar && (
            <>
              <div class="flex items-center gap-1 px-2 py-1 bg-[var(--accent)]/10" title="Radar">
                <GameIcon src={UtilIconPaths.TRAIT_RADAR} size={14} variant="accent" alt="Radar" />
                <span class="text-[10px] font-mono text-[var(--accent)]">RADAR</span>
              </div>
              {radarLow !== null && (
                <div class="flex items-center gap-1 px-2 py-1 bg-[var(--accent)]/10" title="Radar-enhanced low-alt optics">
                  <span class="text-xs font-semibold text-[var(--accent)]">{radarLow}m</span>
                </div>
              )}
              {radarHigh !== null && (
                <div class="flex items-center gap-1 px-2 py-1 bg-[var(--accent)]/10" title="Radar-enhanced high-alt optics">
                  <span class="text-xs font-semibold text-[var(--accent)]">{radarHigh}m</span>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div class="flex-1 flex flex-col justify-start">
          {/* Base optics — vertical icon + value */}
          <div class="grid grid-cols-3 gap-1.5">
            <VStatCell icon={UtilIconPaths.STAT_OPTICS} tooltip="Ground optics" value={`${ground}m`} />
            <VStatCell icon={UtilIconPaths.TRAIT_AIR_ALT_DOWN} tooltip="Low-altitude optics" value={`${lowAlt}m`} />
            <VStatCell icon={UtilIconPaths.TRAIT_AIR_ALT_UP} tooltip="High-altitude optics" value={`${highAlt}m`} />
          </div>

          {/* Radar-enhanced values */}
          {radar && (
            <div class="grid grid-cols-3 gap-1.5 mt-1.5">
              <div class="flex items-center justify-center p-2" title="Radar">
                <GameIcon src={UtilIconPaths.TRAIT_RADAR} size={16} variant="accent" alt="Radar" />
              </div>
              {radarLow !== null && (
                <div class="flex flex-col items-center justify-center gap-1 p-2 bg-[var(--accent)]/10" title="Radar-enhanced low-alt optics">
                  <span class="text-sm font-semibold text-[var(--accent)]">{radarLow}m</span>
                </div>
              )}
              {radarHigh !== null && (
                <div class="flex flex-col items-center justify-center gap-1 p-2 bg-[var(--accent)]/10" title="Radar-enhanced high-alt optics">
                  <span class="text-sm font-semibold text-[var(--accent)]">{radarHigh}m</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const VStatCell = component$<{ icon: string; tooltip: string; value: string; label?: string; compact?: boolean }>(
  ({ icon, tooltip, value, label, compact }) => (
    <div class={`flex flex-col items-center ${compact ? 'gap-1 p-2' : 'gap-1.5 p-2.5'} bg-[var(--bg)]/40`} title={tooltip}>
      <GameIcon src={icon} size={compact ? 16 : 20} variant="white" alt={tooltip} />
      {label && <span class={`${compact ? 'text-[8px]' : 'text-[9px]'} font-mono text-[var(--text-dim)]`}>{label}</span>}
      <span class={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-[var(--text)]`}>{value}</span>
    </div>
  ),
);

const HStatCell = component$<{ icon: string; tooltip: string; value: string }>(
  ({ icon, tooltip, value }) => (
    <div class="flex items-center gap-2 px-2 py-1 bg-[var(--bg)]/40" title={tooltip}>
      <GameIcon src={icon} size={14} variant="white" alt={tooltip} />
      <span class="text-xs font-semibold text-[var(--text)]">{value}</span>
    </div>
  ),
);
