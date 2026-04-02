// ══════════════════════════════════════════════════════════════
// MapSelectionModal — grid of map previews for selection
// ══════════════════════════════════════════════════════════════

import { component$, useSignal, useComputed$, type Signal, type QRL } from '@builder.io/qwik';
import { useI18n, t } from '~/lib/i18n';
import type { MapData, MapSize, MapType } from '~/lib/maps/types';
import { MAPS } from '~/lib/maps/mapData';

export interface MapSelectionModalProps {
  open: Signal<boolean>;
  onSelect$: QRL<(map: MapData) => void>;
}

const SIZE_FILTERS: { value: MapSize; labelKey: string }[] = [
  { value: 'small', labelKey: 'maps.sizeSmall' },
  { value: 'medium', labelKey: 'maps.sizeMedium' },
  { value: 'large', labelKey: 'maps.sizeLarge' },
];

const TYPE_FILTERS: { value: MapType; labelKey: string }[] = [
  { value: 'urban', labelKey: 'maps.typeUrban' },
  { value: 'industrial', labelKey: 'maps.typeIndustrial' },
  { value: 'rural', labelKey: 'maps.typeRural' },
  { value: 'water', labelKey: 'maps.typeWater' },
  { value: 'military', labelKey: 'maps.typeMilitary' },
];

export const MapSelectionModal = component$<MapSelectionModalProps>(({ open, onSelect$ }) => {
  const i18n = useI18n();
  const sizeFilter = useSignal<MapSize | null>(null);
  const typeFilter = useSignal<MapType | null>(null);

  const filteredMaps = useComputed$(() => {
    let result = MAPS;
    if (sizeFilter.value) {
      result = result.filter(m => m.size === sizeFilter.value);
    }
    if (typeFilter.value) {
      result = result.filter(m => m.type === typeFilter.value);
    }
    return result;
  });

  if (!open.value) return null;

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick$={(e) => {
        if (e.target === e.currentTarget) open.value = false;
      }}
    >
      <div class="w-full max-w-4xl max-h-[80vh] mx-4 flex flex-col bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.95)] border border-[rgba(51,51,51,0.3)]">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-[rgba(51,51,51,0.3)]">
          <p class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px]">
            {t(i18n, 'maps.selectMap')}
          </p>
          <button
            class="text-[var(--text-dim)] hover:text-[var(--text)] text-lg leading-none px-1"
            onClick$={() => { open.value = false; }}
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div class="flex flex-wrap gap-2 px-4 py-3 border-b border-[rgba(51,51,51,0.15)]">
          {/* Size filter */}
          <span class="text-[var(--text-dim)] text-xs font-mono mr-1">{t(i18n, 'maps.filterSize')}:</span>
          {SIZE_FILTERS.map(f => (
            <button
              key={f.value}
              class={[
                'px-2 py-0.5 text-xs font-mono border transition-colors',
                sizeFilter.value === f.value
                  ? 'bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)]'
                  : 'text-[var(--text-dim)] border-[rgba(51,51,51,0.3)] hover:border-[var(--accent)] hover:text-[var(--text)]',
              ].join(' ')}
              onClick$={() => {
                sizeFilter.value = sizeFilter.value === f.value ? null : f.value;
              }}
            >
              {t(i18n, f.labelKey)}
            </button>
          ))}
          <span class="text-[var(--text-dim)] text-xs font-mono mr-1 ml-3">{t(i18n, 'maps.filterType')}:</span>
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              class={[
                'px-2 py-0.5 text-xs font-mono border transition-colors',
                typeFilter.value === f.value
                  ? 'bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)]'
                  : 'text-[var(--text-dim)] border-[rgba(51,51,51,0.3)] hover:border-[var(--accent)] hover:text-[var(--text)]',
              ].join(' ')}
              onClick$={() => {
                typeFilter.value = typeFilter.value === f.value ? null : f.value;
              }}
            >
              {t(i18n, f.labelKey)}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div class="flex-1 overflow-y-auto p-4">
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {filteredMaps.value.map(map => (
              <button
                key={map.id}
                class="group flex flex-col gap-1 p-1 border border-[rgba(51,51,51,0.15)] hover:border-[var(--accent)] transition-colors bg-[rgba(26,26,26,0.4)]"
                onClick$={() => {
                  onSelect$(map);
                  open.value = false;
                }}
              >
                <div class="relative w-full aspect-square overflow-hidden bg-[rgba(26,26,26,0.6)]">
                  <img
                    src={map.image.preview}
                    alt={map.displayName}
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                    width={200}
                    height={200}
                    // Fallback to main image if preview doesn't exist
                    onError$={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (!img.dataset.fallback) {
                        img.dataset.fallback = '1';
                        img.src = map.image.main;
                      }
                    }}
                  />
                  {/* Size badge */}
                  <span class="absolute top-1 right-1 px-1 py-0.5 bg-black/60 text-[9px] font-mono text-[var(--text-dim)] uppercase">
                    {map.size[0]}
                  </span>
                </div>
                <span class="text-xs font-mono text-[var(--text)] truncate px-0.5 group-hover:text-[var(--accent)] transition-colors">
                  {map.displayName}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
