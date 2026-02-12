import { component$ } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import { GameIcon } from '~/components/GameIcon';
import { toUnitIconPath, toSpecializationIconPath } from '~/lib/iconPaths';
import { useI18n, getGameLocaleValueOrKey, GAME_LOCALES } from '~/lib/i18n';
import type { UnitDetailAvailability } from '~/routes/arsenal/[unitid]';

type Props = { availability: UnitDetailAvailability[] };

export const UnitAvailabilityPanel = component$<Props>(({ availability }) => {
  const i18n = useI18n();

  return (
    <div class="border border-[var(--border)] bg-[var(--bg-raised)] p-4">
      <p class="text-[10px] font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] mb-3">
        Availability
      </p>
      <div class="flex flex-col gap-3">
        {availability.map(avail => {
          const spec = avail.specialization;
          const specIcon = spec.Icon ? toSpecializationIconPath(spec.Icon) : null;
          const specName = getGameLocaleValueOrKey(
            GAME_LOCALES.specs, spec.UIName || spec.Name, i18n.locale,
          ) || spec.UIName || spec.Name;
          return (
            <div key={spec.Id} class="bg-[var(--bg)]/40 p-2">
              {/* Spec header + count */}
              <div class="flex items-center gap-2 mb-2">
                {specIcon && (
                  <GameIcon src={specIcon} size={20} variant="white" alt={specName} />
                )}
                <span class="text-xs font-semibold text-[var(--text)] truncate flex-1">
                  {specName}
                </span>
                <span class="text-sm font-bold text-[var(--text)]" title="Availability">
                  x{avail.maxAvailability ?? 0}
                </span>
              </div>

              {/* Available transports */}
              {avail.transports.length > 0 && (
                <div>
                  <p class="text-[9px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-1">
                    Transports
                  </p>
                  <div class="flex flex-wrap gap-1">
                    {avail.transports.map(transport => (
                      <Link
                        key={transport.Id}
                        href={`/arsenal/${transport.Id}`}
                        class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[var(--bg-hover)] border border-[var(--border)]
                               text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
                      >
                        {transport.ThumbnailFileName && (
                          <img
                            src={toUnitIconPath(transport.ThumbnailFileName)}
                            width={14} height={14}
                            class="w-3.5 h-3.5 object-contain"
                            alt={transport.Name}
                          />
                        )}
                        {transport.Name}
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
