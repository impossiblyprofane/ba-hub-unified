import { component$ } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import { GameIcon } from '~/components/GameIcon';
import { toUnitIconPath, toSpecializationIconPath } from '~/lib/iconPaths';
import { useI18n, t, getGameLocaleValueOrKey, GAME_LOCALES } from '~/lib/i18n';
import { SimpleTooltip } from '~/components/ui/SimpleTooltip';
import type { UnitDetailAvailability } from '~/lib/graphql-types';

type Props = { availability: UnitDetailAvailability[]; compact?: boolean; fill?: boolean };

export const UnitAvailabilityPanel = component$<Props>(({ availability, compact, fill }) => {
  const i18n = useI18n();

  return (
    <div
      class={`p-0 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] ${fill ? 'h-full flex flex-col' : ''}`}
    >
      <p class={`font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] ${compact ? 'text-[9px] px-2 py-2' : 'text-[10px] px-3 py-2'} border-b border-[rgba(51,51,51,0.3)]`}>
        {t(i18n, 'unitDetail.panel.availability')}
      </p>
      <div class={`flex flex-col ${compact ? 'gap-2' : 'gap-3'} ${fill ? 'flex-1 overflow-y-auto' : ''}`}>
        {availability.map(avail => {
          const spec = avail.specialization;
          const specIcon = spec.Icon ? toSpecializationIconPath(spec.Icon) : null;
          const specName = getGameLocaleValueOrKey(
            GAME_LOCALES.specs, spec.UIName || spec.Name, i18n.locale,
          ) || spec.UIName || spec.Name;
          return (
            <div key={spec.Id} class={`bg-[rgba(26,26,26,0.4)] border border-[rgba(51,51,51,0.1)] ${compact ? 'p-1' : 'p-1.5'}`}>
              {/* Spec header + count */}
              <div class={`flex items-center gap-2 ${compact ? 'mb-1' : 'mb-1.5'}`}>
                {specIcon && (
                  <GameIcon src={specIcon} size={compact ? 18 : 20} variant="white" alt={specName} />
                )}
                <span class={`${compact ? 'text-[11px]' : 'text-xs'} font-semibold text-[var(--text)] truncate flex-1`}>
                  {specName}
                </span>
                <SimpleTooltip text="Availability">
                  <span class={`${compact ? 'text-xs' : 'text-sm'} font-bold text-[var(--text)]`}>
                    x{avail.maxAvailability ?? 0}
                  </span>
                </SimpleTooltip>
              </div>

              {/* Available transports */}
              {avail.transports.length > 0 && (
                <div>
                  <p class={`${compact ? 'text-[8px]' : 'text-[9px]'} font-mono uppercase tracking-widest text-[var(--text-dim)] mb-1`}>
                    {t(i18n, 'unitDetail.panel.transports')}
                  </p>
                  <div class="flex flex-wrap gap-1">
                    {avail.transports.map(transport => (
                      <Link
                        key={transport.Id}
                        href={`/arsenal/${transport.Id}`}
                        class={`inline-flex items-center gap-1 ${compact ? 'px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[10px]'} bg-[var(--bg-hover)] border border-[var(--border)]
                               text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors`}
                      >
                        {transport.ThumbnailFileName && (
                          <img
                            src={toUnitIconPath(transport.ThumbnailFileName)}
                            width={14} height={14}
                            class={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} object-contain`}
                            alt={transport.HUDName}
                          />
                        )}
                        {transport.HUDName}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
