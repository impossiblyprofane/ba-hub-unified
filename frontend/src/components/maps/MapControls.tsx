// ══════════════════════════════════════════════════════════════
// MapControls — zoom, undo/redo, clear, fit-to-view
// ══════════════════════════════════════════════════════════════

import { component$, type Signal, type QRL } from '@builder.io/qwik';
import { useI18n, t } from '~/lib/i18n';
import type { ZoomState } from '~/lib/maps/types';

export interface MapControlsProps {
  zoom: Signal<ZoomState>;
  canUndo: Signal<boolean>;
  canRedo: Signal<boolean>;
  onZoomIn$: QRL<() => void>;
  onZoomOut$: QRL<() => void>;
  onFitView$: QRL<() => void>;
  onUndo$: QRL<() => void>;
  onRedo$: QRL<() => void>;
  onClear$: QRL<() => void>;
}

export const MapControls = component$<MapControlsProps>((props) => {
  const i18n = useI18n();
  const zoomPercent = Math.round(props.zoom.value.scale * 100);

  return (
    <div class="flex flex-col gap-1">
      {/* Zoom controls */}
      <div class="flex flex-col items-center bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.9)] border border-[rgba(51,51,51,0.3)]">
        <button
          class="w-8 h-8 flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          onClick$={() => props.onZoomIn$()}
          title={t(i18n, 'maps.controls.zoomIn')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14m-7-7h14" />
          </svg>
        </button>
        <span class="text-[9px] font-mono text-[var(--text-dim)] py-0.5">{zoomPercent}%</span>
        <button
          class="w-8 h-8 flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          onClick$={() => props.onZoomOut$()}
          title={t(i18n, 'maps.controls.zoomOut')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14" />
          </svg>
        </button>
        <div class="w-6 border-t border-[rgba(51,51,51,0.3)]" />
        <button
          class="w-8 h-8 flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          onClick$={() => props.onFitView$()}
          title={t(i18n, 'maps.controls.fitView')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h6v6m-6 6h6v6M3 3h6v6M3 15h6v6" />
          </svg>
        </button>
      </div>

      {/* Undo / Redo */}
      <div class="flex flex-col items-center bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.9)] border border-[rgba(51,51,51,0.3)]">
        <button
          class={[
            'w-8 h-8 flex items-center justify-center transition-colors',
            props.canUndo.value
              ? 'text-[var(--text-dim)] hover:text-[var(--text)]'
              : 'text-[rgba(51,51,51,0.4)] cursor-not-allowed',
          ].join(' ')}
          onClick$={() => props.onUndo$()}
          disabled={!props.canUndo.value}
          title={t(i18n, 'maps.controls.undo') + ' (Ctrl+Z)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H12m-9-10l4-4m-4 4l4 4" />
          </svg>
        </button>
        <button
          class={[
            'w-8 h-8 flex items-center justify-center transition-colors',
            props.canRedo.value
              ? 'text-[var(--text-dim)] hover:text-[var(--text)]'
              : 'text-[rgba(51,51,51,0.4)] cursor-not-allowed',
          ].join(' ')}
          onClick$={() => props.onRedo$()}
          disabled={!props.canRedo.value}
          title={t(i18n, 'maps.controls.redo') + ' (Ctrl+Y)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10H11a5 5 0 00-5 5v0a5 5 0 005 5h1m9-10l-4-4m4 4l-4 4" />
          </svg>
        </button>
      </div>

      {/* Clear */}
      <div class="flex flex-col items-center bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.9)] border border-[rgba(51,51,51,0.3)]">
        <button
          class="w-8 h-8 flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--red)] transition-colors"
          onClick$={() => props.onClear$()}
          title={t(i18n, 'maps.controls.clear')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
});
