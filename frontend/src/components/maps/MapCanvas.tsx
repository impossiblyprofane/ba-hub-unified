// ══════════════════════════════════════════════════════════════
// MapCanvas — Qwik wrapper for the Konva canvas manager
//
// ARCHITECTURE: We use a SINGLE init hook (no track) to create the
// manager once, then SEPARATE lightweight hooks for each tracked
// signal. This avoids the Qwik trap where multiple track() calls
// in one useVisibleTask$ cause a full re-run (destroying and
// recreating the manager) whenever ANY tracked signal changes.
//
// SIZING: The container uses `absolute inset-0` (not `w-full h-full`)
// so that dimensions are resolved from the positioning context rather
// than CSS percentage height. This avoids edge-cases where `height:100%`
// fails to resolve inside conditionally-rendered flex items.
//
// EVENTS: `touch-action: none` prevents the browser from intercepting
// pointer events for scrolling/gestures. A native DOM `pointermove`
// listener provides a fallback for mouse tracking independent of Konva.
// ══════════════════════════════════════════════════════════════

import { component$, noSerialize, useSignal, useVisibleTask$, type NoSerialize, type Signal, type QRL } from '@builder.io/qwik';
import type { MapCanvasManager } from '~/lib/maps/canvasManager';
import type { MapData, ISRTool, Shape, DisplayToggles, ZoomState, Point, RangeCircle } from '~/lib/maps/types';
import { isUnitShape } from '~/lib/maps/types';
import { PIXELS_TO_METERS } from '~/lib/maps/constants';

export interface MapCanvasProps {
  currentMap: Signal<MapData | null>;
  activeTool: Signal<ISRTool>;
  activeColor: Signal<string>;
  shapes: Signal<Shape[]>;
  toggles: Signal<DisplayToggles>;
  zoom: Signal<ZoomState>;
  mouseMeters: Signal<Point>;
  mouseScreen: Signal<Point>;
  shiftDown: Signal<boolean>;
  selectedIds: Signal<string[]>;
  activeMarkerType: Signal<string>;
  /** Command channel for zoom buttons: 'in:<ts>', 'out:<ts>', 'fit:<ts>' */
  zoomCommand: Signal<string>;
  /** Range circles per unit shape id — rendered when ranges toggle is on */
  unitRangeCache: Signal<Record<string, RangeCircle[]>>;
  onShapeCreated$: QRL<(shape: Shape) => void>;
  onShapeUpdated$: QRL<(shape: Shape) => void>;
  onShapeClick$: QRL<(id: string, addToSelection: boolean) => void>;
  onDeselect$: QRL<() => void>;
  onPing$: QRL<(x: number, y: number) => void>;
  onCanvasPlace$: QRL<(x: number, y: number) => void>;
}

/** Wait one animation frame — lets the browser finalise layout before we read getBoundingClientRect */
function waitForLayout(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export const MapCanvas = component$<MapCanvasProps>((props) => {
  const canvasRef = useSignal<HTMLDivElement>();
  // Holds the MapCanvasManager instance — wrapped in noSerialize() so Qwik skips it
  const managerRef = useSignal<NoSerialize<MapCanvasManager>>();

  // ── Init: create manager ONCE (no track → never re-runs) ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ cleanup }) => {
    const container = canvasRef.value;
    if (!container) return;

    // ── Wait until the container has non-zero layout (needed after conditional render) ──
    let rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn('[MapCanvas] Container has 0 dimensions on first read, waiting for layout…');
      await waitForLayout();
      rect = container.getBoundingClientRect();
    }
    if (rect.width === 0 || rect.height === 0) {
      console.error('[MapCanvas] Container still has 0 dimensions after rAF — aborting init', rect);
      return;
    }

    // ── Dynamic import of canvas manager (code-split) ──
    const { MapCanvasManager } = await import('~/lib/maps/canvasManager');

    const manager = new MapCanvasManager(container, {
      onMouseMove: (_cx, _cy, mx, my, sx, sy) => {
        props.mouseMeters.value = { x: mx, y: my };
        props.mouseScreen.value = { x: sx, y: sy };
      },
      onZoomChange: (z) => {
        props.zoom.value = z;
      },
      onShapeCreated: (shape) => {
        props.onShapeCreated$(shape);
      },
      onShapeUpdated: (shape) => {
        props.onShapeUpdated$(shape);
      },
      onShapeClick: (id, add) => {
        props.onShapeClick$(id, add);
      },
      onCanvasClick: (canvasX, canvasY) => {
        const tool = props.activeTool.value;
        if (tool === 'marker' || tool === 'unit') {
          props.onCanvasPlace$(canvasX, canvasY);
        } else {
          props.onDeselect$();
        }
      },
      onPing: (cx, cy) => {
        props.onPing$(cx, cy);
      },
    });

    // Apply ALL initial state so the manager starts correct
    manager.setTool(props.activeTool.value);
    manager.setColor(props.activeColor.value);
    manager.setShiftDown(props.shiftDown.value);
    manager.setDisplayToggles(props.toggles.value);
    manager.setSelection(props.selectedIds.value);

    if (props.currentMap.value) {
      manager.loadMap(props.currentMap.value);
    }
    if (props.shapes.value.length > 0) {
      manager.renderShapes(props.shapes.value, props.toggles.value);
    }

    // ── Diagnostics — log canvas dimensions & event wiring ──
    const konvaContent = container.querySelector('.konvajs-content') as HTMLElement | null;
    console.log('[MapCanvas] Init OK', {
      containerRect: { w: rect.width, h: rect.height },
      konvaContentRect: konvaContent
        ? { w: konvaContent.offsetWidth, h: konvaContent.offsetHeight }
        : 'NOT FOUND',
      stageSize: manager.getContainerSize(),
    });

    // ── Native DOM pointermove — guarantees mouse tracking even if Konva events are blocked ──
    const nativePointerMove = (e: PointerEvent) => {
      const cRect = container.getBoundingClientRect();
      const sx = e.clientX - cRect.left;
      const sy = e.clientY - cRect.top;
      props.mouseScreen.value = { x: sx, y: sy };

      // Convert screen coords → canvas → meters using the current zoom state
      const z = props.zoom.value;
      const cx = (sx - z.x) / z.scale;
      const cy = (sy - z.y) / z.scale;
      props.mouseMeters.value = { x: cx * PIXELS_TO_METERS, y: cy * PIXELS_TO_METERS };
    };
    container.addEventListener('pointermove', nativePointerMove);

    managerRef.value = noSerialize(manager);

    cleanup(() => {
      container.removeEventListener('pointermove', nativePointerMove);
      manager.destroy();
      managerRef.value = undefined;
    });
  });

  // ── Track: map changes ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const map = track(() => props.currentMap.value);
    const m = managerRef.value;
    if (m && map) m.loadMap(map);
  });

  // ── Track: tool changes ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const tool = track(() => props.activeTool.value);
    const m = managerRef.value;
    if (m) m.setTool(tool);
  });

  // ── Track: color changes ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const color = track(() => props.activeColor.value);
    const m = managerRef.value;
    if (m) m.setColor(color);
  });

  // ── Track: shapes + toggles (both tracked so visibility filtering stays in sync) ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const shapes = track(() => props.shapes.value);
    const toggles = track(() => props.toggles.value);
    const m = managerRef.value;
    if (m) {
      m.setDisplayToggles(toggles);
      m.renderShapes(shapes, toggles);
    }
  });

  // ── Track: selection changes ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const ids = track(() => props.selectedIds.value);
    const m = managerRef.value;
    if (m) m.setSelection(ids);
  });

  // ── Track: shift key ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const down = track(() => props.shiftDown.value);
    const m = managerRef.value;
    if (m) m.setShiftDown(down);
  });

  // ── Track: zoom commands from UI buttons ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const cmd = track(() => props.zoomCommand.value);
    if (!cmd) return;
    const m = managerRef.value;
    if (!m) return;
    if (cmd.startsWith('in:')) m.zoomByStep(1);
    else if (cmd.startsWith('out:')) m.zoomByStep(-1);
    else if (cmd.startsWith('fit:')) m.fitToView();
  });

  // ── Track: unit range cache + toggles → render/clear range circles ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const cache = track(() => props.unitRangeCache.value);
    const toggles = track(() => props.toggles.value);
    const shapes = track(() => props.shapes.value);
    const m = managerRef.value;
    if (!m) return;

    // Clear all existing range circles first
    for (const shape of shapes) {
      if (isUnitShape(shape)) {
        m.clearUnitRanges(shape.id);
      }
    }

    // Re-render ranges only when the ranges toggle is on
    if (toggles.ranges) {
      for (const shape of shapes) {
        if (isUnitShape(shape) && cache[shape.id]) {
          m.renderUnitRanges(shape.id, shape.x, shape.y, cache[shape.id]);
        }
      }
    }
  });

  return (
    <div
      ref={canvasRef}
      class="absolute inset-0 z-0"
      style={{ touchAction: 'none' }}
      onContextMenu$={(e) => e.preventDefault()}
    />
  );
});
