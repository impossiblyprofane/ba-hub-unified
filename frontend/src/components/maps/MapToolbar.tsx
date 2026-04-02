// ══════════════════════════════════════════════════════════════
// MapToolbar — tool selection, color picker, display toggles
// ══════════════════════════════════════════════════════════════

import { component$, type Signal, type QRL } from '@builder.io/qwik';
import { useI18n, t } from '~/lib/i18n';
import type { ISRTool, DisplayToggles } from '~/lib/maps/types';
import { TOOLS, TOOLBAR_COLORS } from '~/lib/maps/constants';

export interface MapToolbarProps {
  activeTool: Signal<ISRTool>;
  activeColor: Signal<string>;
  toggles: Signal<DisplayToggles>;
  onOpenMapSelector$: QRL<() => void>;
  onOpenMarkerBar$: QRL<() => void>;
  onOpenUnitBar$: QRL<() => void>;
}

/** SVG icons for each tool (simple geometric shapes) */
const TOOL_ICONS: Record<string, string> = {
  pan: 'M12 2L8 6h3v4H7V7L3 11l4 4v-3h4v4H8l4 4 4-4h-3v-4h4v3l4-4-4-4v3h-4V6h3z',
  select: 'M4 2l12 9.5-5.3.8L14 20l-3.2 1.2L7.5 14 4 18z',
  arrow: 'M4 12h12m0 0l-4-4m4 4l-4 4',
  line: 'M4 20L20 4',
  circle: 'M12 2a10 10 0 100 20 10 10 0 000-20z',
  marker: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z',
  unit: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
};

export const MapToolbar = component$<MapToolbarProps>((props) => {
  const i18n = useI18n();

  return (
    <div class="flex items-center gap-1 p-1 bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.9)] border border-[rgba(51,51,51,0.3)]">
      {/* Map selector button */}
      <button
        class="flex items-center gap-1 px-2 py-1.5 text-xs font-mono text-[var(--text-dim)] hover:text-[var(--text)] border border-[rgba(51,51,51,0.3)] hover:border-[var(--accent)] transition-colors"
        onClick$={() => props.onOpenMapSelector$()}
        title={t(i18n, 'maps.selectMap')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" />
          <path d="M8 2v16m8-12v16" />
        </svg>
        <span class="hidden sm:inline">{t(i18n, 'maps.selectMap')}</span>
      </button>

      {/* Separator */}
      <div class="w-px h-6 bg-[rgba(51,51,51,0.3)] mx-1" />

      {/* Tool buttons */}
      {TOOLS.map(tool => (
        <button
          key={tool.id}
          class={[
            'relative flex items-center justify-center w-8 h-8 border transition-colors',
            props.activeTool.value === tool.id
              ? 'bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)]'
              : 'text-[var(--text-dim)] border-[rgba(51,51,51,0.15)] hover:border-[var(--accent)] hover:text-[var(--text)]',
          ].join(' ')}
          onClick$={() => {
            props.activeTool.value = tool.id as ISRTool;
            if (tool.id === 'marker') props.onOpenMarkerBar$();
            else if (tool.id === 'unit') props.onOpenUnitBar$();
          }}
          title={`${t(i18n, tool.labelKey)} (${tool.keybind})`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d={TOOL_ICONS[tool.id] || ''} />
          </svg>
          <span class="absolute -bottom-0.5 -right-0.5 text-[7px] font-mono text-[var(--text-dim)] opacity-60">
            {tool.keybind === 'Space' ? '⎵' : tool.keybind}
          </span>
        </button>
      ))}

      {/* Separator */}
      <div class="w-px h-6 bg-[rgba(51,51,51,0.3)] mx-1" />

      {/* Color picker */}
      <div class="flex items-center gap-0.5">
        {TOOLBAR_COLORS.map(color => (
          <button
            key={color.value}
            class={[
              'w-5 h-5 rounded-sm border transition-all',
              props.activeColor.value === color.value
                ? 'border-white scale-110'
                : 'border-[rgba(51,51,51,0.3)] hover:border-[rgba(255,255,255,0.5)]',
            ].join(' ')}
            style={{ backgroundColor: color.value }}
            onClick$={() => { props.activeColor.value = color.value; }}
            title={color.name}
          />
        ))}
      </div>

      {/* Separator */}
      <div class="w-px h-6 bg-[rgba(51,51,51,0.3)] mx-1" />

      {/* Display toggles */}
      {([
        { key: 'objectives' as const, labelKey: 'maps.toggle.objectives' },
        { key: 'ranges' as const, labelKey: 'maps.toggle.ranges' },
        { key: 'markers' as const, labelKey: 'maps.toggle.markers' },
        { key: 'units' as const, labelKey: 'maps.toggle.units' },
      ]).map(toggle => (
        <button
          key={toggle.key}
          class={[
            'px-1.5 py-1 text-[9px] font-mono tracking-wider uppercase border transition-colors',
            props.toggles.value[toggle.key]
              ? 'bg-[rgba(70,151,195,0.2)] text-[var(--accent)] border-[var(--accent)]'
              : 'text-[var(--text-dim)] border-[rgba(51,51,51,0.15)] hover:border-[rgba(51,51,51,0.3)]',
          ].join(' ')}
          onClick$={() => {
            props.toggles.value = {
              ...props.toggles.value,
              [toggle.key]: !props.toggles.value[toggle.key],
            };
          }}
          title={t(i18n, toggle.labelKey)}
        >
          {t(i18n, toggle.labelKey)}
        </button>
      ))}
    </div>
  );
});
