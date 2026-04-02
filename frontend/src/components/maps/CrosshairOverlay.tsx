// ══════════════════════════════════════════════════════════════
// CrosshairOverlay — HTML overlay for drawing cursor + coords
// ══════════════════════════════════════════════════════════════

import { component$, type Signal } from '@builder.io/qwik';
import type { ISRTool, Point } from '~/lib/maps/types';

export interface CrosshairOverlayProps {
  /** Current tool */
  activeTool: Signal<ISRTool>;
  /** Mouse screen position */
  mouseScreen: Signal<Point>;
  /** Mouse position in meters */
  mouseMeters: Signal<Point>;
  /** Whether canvas has a map loaded */
  hasMap: boolean;
}

const CROSSHAIR_TOOLS: ISRTool[] = ['arrow', 'line', 'circle', 'marker', 'unit'];

export const CrosshairOverlay = component$<CrosshairOverlayProps>(
  ({ activeTool, mouseScreen, mouseMeters, hasMap }) => {
    const show = hasMap && CROSSHAIR_TOOLS.includes(activeTool.value);

    if (!show) return null;

    const sx = mouseScreen.value.x;
    const sy = mouseScreen.value.y;
    const mx = Math.round(mouseMeters.value.x);
    const my = Math.round(mouseMeters.value.y);

    return (
      <div class="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 10 }}>
        {/* Horizontal line */}
        <div
          class="absolute left-0 right-0 border-t border-dashed border-[rgba(187,187,187,0.5)]"
          style={{ top: `${sy}px` }}
        />
        {/* Vertical line */}
        <div
          class="absolute top-0 bottom-0 border-l border-dashed border-[rgba(187,187,187,0.5)]"
          style={{ left: `${sx}px` }}
        />
        {/* Coordinate label */}
        <div
          class="absolute px-1.5 py-0.5 bg-black/70 text-[10px] font-mono text-[var(--text-dim)]"
          style={{ left: `${sx + 12}px`, top: `${sy + 12}px` }}
        >
          {mx}, {my}m
        </div>
      </div>
    );
  },
);
