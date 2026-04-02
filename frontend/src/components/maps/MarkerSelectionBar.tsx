// ══════════════════════════════════════════════════════════════
// MarkerSelectionBar — marker type picker (unit + objective)
// ══════════════════════════════════════════════════════════════

import { component$, type Signal } from '@builder.io/qwik';
import { useI18n, t } from '~/lib/i18n';
import { MARKER_ICONS } from '~/lib/maps/constants';

export interface MarkerSelectionBarProps {
  activeMarkerType: Signal<string>;
  visible: boolean;
}

export const MarkerSelectionBar = component$<MarkerSelectionBarProps>(({ activeMarkerType, visible }) => {
  const i18n = useI18n();

  if (!visible) return null;

  const unitMarkers = MARKER_ICONS.filter(m => m.category === 'unit');
  const objectiveMarkers = MARKER_ICONS.filter(m => m.category === 'objective');

  return (
    <div class="flex items-center gap-2 px-2 py-1.5 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.9)] border border-[rgba(51,51,51,0.3)] border-t-0">
      {/* Unit markers */}
      <span class="text-[8px] font-mono text-[var(--text-dim)] uppercase tracking-wider">
        {t(i18n, 'maps.markers.unitMarkers')}
      </span>
      <div class="flex items-center gap-0.5">
        {unitMarkers.map(marker => (
          <button
            key={marker.id}
            class={[
              'w-7 h-7 flex items-center justify-center border transition-all',
              activeMarkerType.value === marker.id
                ? 'border-[var(--accent)] bg-[rgba(70,151,195,0.15)] brightness-125'
                : 'border-[rgba(51,51,51,0.15)] hover:border-[rgba(51,51,51,0.3)]',
            ].join(' ')}
            onClick$={() => { activeMarkerType.value = marker.id; }}
            title={t(i18n, marker.labelKey)}
          >
            <img
              src={marker.iconPath}
              alt={t(i18n, marker.labelKey)}
              width={20}
              height={20}
              class="w-5 h-5 object-contain"
            />
          </button>
        ))}
      </div>

      <div class="w-px h-5 bg-[rgba(51,51,51,0.3)] mx-1" />

      {/* Objective/command markers */}
      <span class="text-[8px] font-mono text-[var(--text-dim)] uppercase tracking-wider">
        {t(i18n, 'maps.markers.objectiveMarkers')}
      </span>
      <div class="flex items-center gap-0.5">
        {objectiveMarkers.map(marker => (
          <button
            key={marker.id}
            class={[
              'w-7 h-7 flex items-center justify-center border transition-all',
              activeMarkerType.value === marker.id
                ? 'border-[var(--accent)] bg-[rgba(70,151,195,0.15)] brightness-125'
                : 'border-[rgba(51,51,51,0.15)] hover:border-[rgba(51,51,51,0.3)]',
            ].join(' ')}
            onClick$={() => { activeMarkerType.value = marker.id; }}
            title={t(i18n, marker.labelKey)}
          >
            <img
              src={marker.iconPath}
              alt={t(i18n, marker.labelKey)}
              width={20}
              height={20}
              class="w-5 h-5 object-contain"
            />
          </button>
        ))}
      </div>
    </div>
  );
});
