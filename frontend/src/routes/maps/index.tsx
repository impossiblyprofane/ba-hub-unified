// ══════════════════════════════════════════════════════════════
// Maps & Tactical Planning — full-viewport interactive map
// ══════════════════════════════════════════════════════════════

import { $, component$, useSignal, useComputed$, useVisibleTask$, noSerialize, type NoSerialize } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { useI18n, t } from '~/lib/i18n';
import type { MapData, ISRTool, Shape, LineShape, CircleShape, MarkerShape, DisplayToggles, ZoomState, Point, UnitShape, RangeCircle, UnitRangeFilter, OpticsStealthConfig, SessionMode, SessionUser } from '~/lib/maps/types';
import { generateShapeId, isUnitShape, DEFAULT_OPTICS_STEALTH } from '~/lib/maps/types';
import { TOOLBAR_COLORS, MARKER_ICONS, DEFAULT_UNIT_SIZE } from '~/lib/maps/constants';
import { MapCanvas } from '~/components/maps/MapCanvas';
import { MapToolbar } from '~/components/maps/MapToolbar';
import { MapControls } from '~/components/maps/MapControls';
import { MapSelectionModal } from '~/components/maps/MapSelectionModal';
import { MarkerSelectionBar } from '~/components/maps/MarkerSelectionBar';
import { UnitSelectionBar, type SelectedUnit } from '~/components/maps/UnitSelectionBar';
import { UnitLookupModal } from '~/components/maps/UnitLookupModal';
import { UnitContextPanel } from '~/components/maps/UnitContextPanel';
import { ISRSessionControls } from '~/components/maps/ISRSessionControls';
import { CrosshairOverlay } from '~/components/maps/CrosshairOverlay';
import { KeybindLegend } from '~/components/maps/KeybindLegend';
import { calculateUnitRanges, filterRanges, DEFAULT_RANGE_FILTER, getWeaponNamesFromRanges, getWeaponAltitudesFromRanges, buildDefaultDisabledAltitudes, hasMultipleOptics } from '~/lib/maps/rangeCalculator';
import { getMapByKey } from '~/lib/maps/mapData';
import { SessionManager } from '~/lib/maps/sessionManager';
import type { UnitDetailData } from '~/lib/graphql-types';
import { UNIT_DETAIL_QUERY } from '~/lib/queries/unit-detail';

// ── Constants ──
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
const MAP_STATE_KEY = 'ba_maps_state';

async function fetchUnitDetail(id: number, optionIds: number[]): Promise<UnitDetailData> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: UNIT_DETAIL_QUERY,
      variables: { id, optionIds: optionIds.length ? optionIds : null },
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json() as { data?: { unitDetail: UnitDetailData }; errors?: Array<{ message: string }> };
  if (!json.data?.unitDetail) {
    throw new Error(json.errors?.map(e => e.message).join(', ') || 'Unit not found');
  }
  return json.data.unitDetail;
}

export default component$(() => {
  const i18n = useI18n();

  // ── Core state ──
  const currentMap = useSignal<MapData | null>(null);
  const activeTool = useSignal<ISRTool>('pan');
  const activeColor = useSignal<string>(TOOLBAR_COLORS[0].value);
  const shapes = useSignal<Shape[]>([]);
  const toggles = useSignal<DisplayToggles>({
    objectives: true,
    ranges: true,
    markers: true,
    units: true,
  });
  const zoom = useSignal<ZoomState>({ x: 0, y: 0, scale: 1 });
  const mouseMeters = useSignal<Point>({ x: 0, y: 0 });
  const mouseScreen = useSignal<Point>({ x: 0, y: 0 });
  const shiftDown = useSignal(false);
  const selectedIds = useSignal<string[]>([]);
  const activeMarkerType = useSignal('infantry');

  // ── UI modals ──
  const showMapSelector = useSignal(false);
  const showMarkerBar = useSignal(false);
  const showUnitLookup = useSignal(false);

  // ── Unit placement state ──
  const selectedUnit = useSignal<SelectedUnit | null>(null);
  /** Range cache: shapeId → RangeCircle[] (ALL ranges, before filtering) */
  const unitRangeCache = useSignal<Record<string, RangeCircle[]>>({});
  /** Per-unit range filter: shapeId → UnitRangeFilter */
  const unitRangeFilters = useSignal<Record<string, UnitRangeFilter>>({});
  /** Cached unit detail data per shape for modification controls */
  const unitDetailCache = useSignal<Record<string, UnitDetailData>>({});
  /** Loading state for unit detail fetches */
  const unitDetailLoading = useSignal<Record<string, boolean>>({});

  // ── Session state ──
  const sessionMgr = useSignal<NoSerialize<SessionManager>>(undefined);
  const sessionMode = useSignal<SessionMode>('local');
  const sessionId = useSignal<string | null>(null);
  const sessionUsers = useSignal<SessionUser[]>([]);
  const connectionStatus = useSignal<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const localUserName = useSignal('Anonymous');
  const localClientId = useSignal(0);

  // ── Undo/redo (driven by Y.UndoManager via SessionManager) ──
  const canUndo = useSignal(false);
  const canRedo = useSignal(false);

  // ── Clipboard for copy/paste ──
  const clipboard = useSignal<Shape[]>([]);

  // ── Global optics stealth simulation config ──
  const opticsStealthConfig = useSignal<OpticsStealthConfig>({ ...DEFAULT_OPTICS_STEALTH });

  /**
   * Computed: filtered range cache (applies per-unit range filter).
   * This is what MapCanvas receives — only the enabled categories.
   */
  const filteredRangeCache = useComputed$(() => {
    const allRanges = unitRangeCache.value;
    const filters = unitRangeFilters.value;
    const stealthCfg = opticsStealthConfig.value;
    const result: Record<string, RangeCircle[]> = {};
    for (const [shapeId, ranges] of Object.entries(allRanges)) {
      const filter = filters[shapeId] ?? DEFAULT_RANGE_FILTER;
      result[shapeId] = filterRanges(ranges, filter, stealthCfg);
    }
    return result;
  });

  // ── Zoom command channel (avoids bidirectional signal loop) ──
  const zoomCmd = useSignal('');

  // ── Initialise SessionManager (client-only, non-serializable) ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    // ── Restore persisted local state ──
    try {
      const raw = sessionStorage.getItem(MAP_STATE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { mapKey?: string; shapes?: Shape[] };
        if (saved.mapKey) {
          const map = getMapByKey(saved.mapKey);
          if (map) {
            currentMap.value = map;
            if (saved.shapes && saved.shapes.length > 0) {
              shapes.value = saved.shapes;
            }
          }
        }
      }
    } catch { /* ignore corrupt storage */ }

    const mgr = new SessionManager({
      onShapesChanged: (s) => {
        shapes.value = s;
        // Auto-hydrate unit shapes that arrived from a remote peer.
        // If we don't have cached detail data for a unit shape, fetch it
        // so ranges, modifications, and labels work for the observer.
        for (const shape of s) {
          if (shape.type === 'unit' && (shape as UnitShape).unitId != null) {
            const us = shape as UnitShape;
            const alreadyCached = unitDetailCache.value[us.id];
            const alreadyLoading = unitDetailLoading.value[us.id];
            if (!alreadyCached && !alreadyLoading) {
              // Ensure a default range filter exists
              if (!unitRangeFilters.value[us.id]) {
                unitRangeFilters.value = { ...unitRangeFilters.value, [us.id]: { ...DEFAULT_RANGE_FILTER } };
              }
              unitDetailLoading.value = { ...unitDetailLoading.value, [us.id]: true };
              const optionIds = us.unitOptions ?? [];
              fetchUnitDetail(us.unitId, optionIds)
                .then(detail => {
                  unitDetailCache.value = { ...unitDetailCache.value, [us.id]: detail };
                  const ranges = calculateUnitRanges(detail);
                  if (ranges.length > 0) {
                    unitRangeCache.value = { ...unitRangeCache.value, [us.id]: ranges };
                    // Set default altitude filter: only highest-range altitudes enabled
                    const defaultAlts = buildDefaultDisabledAltitudes(ranges);
                    if (Object.keys(defaultAlts).length > 0) {
                      const existing = unitRangeFilters.value[us.id] ?? { ...DEFAULT_RANGE_FILTER };
                      unitRangeFilters.value = { ...unitRangeFilters.value, [us.id]: { ...existing, disabledWeaponAltitudes: defaultAlts } };
                    }
                  }
                })
                .catch(err => console.warn('Failed to hydrate remote unit:', err))
                .finally(() => {
                  unitDetailLoading.value = { ...unitDetailLoading.value, [us.id]: false };
                });
            }
          }
        }
      },
      onSessionUsersChanged: (u) => { sessionUsers.value = u; },
      onPingReceived: (_ping) => {
        // Canvas ping animation is handled separately via canvasManager.showPing
      },
      onConnectionStatusChanged: (status) => { connectionStatus.value = status; },
      onUndoStackChanged: (cu, cr) => { canUndo.value = cu; canRedo.value = cr; },
      onSessionStateChanged: (mode, sid, host) => {
        sessionMode.value = mode;
        sessionId.value = sid;
        void host;
      },
      onMapChanged: (mapKey) => {
        // When a remote map key is synced (e.g. joining client), load the map
        if (mapKey) {
          const map = getMapByKey(mapKey);
          if (map && map.key !== currentMap.value?.key) {
            currentMap.value = map;
            // Reset local caches for the new map
            selectedIds.value = [];
            unitRangeCache.value = {};
            unitRangeFilters.value = {};
            unitDetailCache.value = {};
            unitDetailLoading.value = {};
          }
        }
      },
    });
    sessionMgr.value = noSerialize(mgr);
    localClientId.value = (mgr as unknown as { ydoc: { clientID: number } }).ydoc?.clientID ?? 0;

    // If restored shapes exist (from sessionStorage), load them into the Yjs doc
    // so undo/redo and sync work correctly.
    if (shapes.value.length > 0) {
      for (const shape of shapes.value) {
        mgr.addShape(shape);
      }
    }
    // If a map was restored, set the metadata
    if (currentMap.value) {
      mgr.setMapMetadata(currentMap.value.key);
    }

    cleanup(() => mgr.destroy());
  });

  // ── Persist local state to sessionStorage ──
  // Saves map key + shapes whenever they change so navigating away and back restores state.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const mapVal = track(() => currentMap.value);
    const shapesVal = track(() => shapes.value);
    try {
      const state = {
        mapKey: mapVal?.key ?? null,
        shapes: shapesVal,
      };
      sessionStorage.setItem(MAP_STATE_KEY, JSON.stringify(state));
    } catch { /* storage full or unavailable — ignore */ }
  });

  // ── Warn before leaving when in collaborative session ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    const mode = track(() => sessionMode.value);

    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (mode === 'collaborative') {
        e.preventDefault();
        // Modern browsers show a generic message; returnValue is still required.
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', beforeUnload);
    cleanup(() => window.removeEventListener('beforeunload', beforeUnload));
  });

  // ── Keyboard shortcut handler ──
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if an input element is focused
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      shiftDown.value = e.shiftKey;

      // Ctrl shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          sessionMgr.value?.undo();
          return;
        }
        if (e.key === 'y') {
          e.preventDefault();
          sessionMgr.value?.redo();
          return;
        }
        // Copy
        if (e.key === 'c') {
          if (selectedIds.value.length > 0) {
            e.preventDefault();
            const selected = shapes.value.filter(s => selectedIds.value.includes(s.id));
            clipboard.value = selected.map(s => ({ ...s }));
          }
          return;
        }
        // Paste
        if (e.key === 'v') {
          if (clipboard.value.length > 0) {
            e.preventDefault();
            const OFFSET = 20; // px offset so paste is visually distinct
            const now = Date.now();
            const newIds: string[] = [];
            for (const src of clipboard.value) {
              const newId = generateShapeId();
              newIds.push(newId);
              const base = { ...src, id: newId, createdAt: now, updatedAt: now };
              let clone: Shape;
              if (src.type === 'line' || src.type === 'arrow') {
                const lineSrc = src as LineShape;
                clone = { ...base, type: lineSrc.type, points: lineSrc.points.map((v, i) => i % 2 === 0 ? v + OFFSET : v + OFFSET) } as LineShape;
              } else if (src.type === 'ring') {
                clone = { ...base, x: (src as CircleShape).x + OFFSET, y: (src as CircleShape).y + OFFSET } as CircleShape;
              } else if (src.type === 'marker') {
                clone = { ...base, x: (src as MarkerShape).x + OFFSET, y: (src as MarkerShape).y + OFFSET } as MarkerShape;
              } else {
                // unit
                clone = { ...base, x: (src as UnitShape).x + OFFSET, y: (src as UnitShape).y + OFFSET, unitOptions: [...(src as UnitShape).unitOptions] } as UnitShape;
              }
              sessionMgr.value?.addShape(clone);
            }
            // Select the newly pasted shapes
            selectedIds.value = newIds;
          }
          return;
        }
        return;
      }

      // Tool number keys
      const toolMap: Record<string, ISRTool> = {
        '1': 'select',
        '2': 'arrow',
        '3': 'line',
        '4': 'circle',
        '5': 'marker',
        '6': 'unit',
      };
      if (toolMap[e.key]) {
        activeTool.value = toolMap[e.key];
        if (e.key === '5') showMarkerBar.value = true;
        else showMarkerBar.value = false;
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        activeTool.value = 'pan';
        return;
      }

      // Display toggles
      if (e.key.toLowerCase() === 'q') {
        toggles.value = { ...toggles.value, objectives: !toggles.value.objectives };
        return;
      }
      if (e.key.toLowerCase() === 'w') {
        e.preventDefault();
        toggles.value = { ...toggles.value, ranges: !toggles.value.ranges };
        return;
      }
      if (e.key.toLowerCase() === 'e') {
        toggles.value = { ...toggles.value, markers: !toggles.value.markers };
        return;
      }
      if (e.key.toLowerCase() === 'r') {
        toggles.value = { ...toggles.value, units: !toggles.value.units };
        return;
      }

      // Color cycling
      if (e.key.toLowerCase() === 'a') {
        const idx = TOOLBAR_COLORS.findIndex(c => c.value === activeColor.value);
        activeColor.value = TOOLBAR_COLORS[(idx + 1) % TOOLBAR_COLORS.length].value as string;
        return;
      }

      // Delete selection
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.value.length > 0) {
          sessionMgr.value?.deleteShapes(selectedIds.value);
          selectedIds.value = [];
        }
        return;
      }

      // Deselect
      if (e.key === 'Escape') {
        selectedIds.value = [];
        showMapSelector.value = false;
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      shiftDown.value = e.shiftKey;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  });

  // ── Callbacks ──
  const handleShapeCreated = $((shape: Shape) => {
    sessionMgr.value?.addShape(shape);
  });

  const handleShapeClick = $((id: string, addToSelection: boolean) => {
    if (addToSelection) {
      const current = selectedIds.value;
      selectedIds.value = current.includes(id)
        ? current.filter(s => s !== id)
        : [...current, id];
    } else {
      selectedIds.value = [id];
    }
  });

  const handleDeselect = $(() => {
    selectedIds.value = [];
  });

  const handleShapeUpdated = $((shape: Shape) => {
    sessionMgr.value?.updateShape(shape);
  });

  const handlePing = $((x: number, y: number) => {
    sessionMgr.value?.sendPing(x, y);
  });

  const handleCanvasPlace = $((cx: number, cy: number) => {
    const tool = activeTool.value;
    if (tool === 'marker') {
      const markerDef = MARKER_ICONS.find(m => m.id === activeMarkerType.value);
      if (!markerDef) return;
      const newShape: Shape = {
        id: generateShapeId(),
        type: 'marker',
        color: activeColor.value,
        x: cx,
        y: cy,
        markerType: markerDef.id,
        icon: markerDef.iconPath,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      sessionMgr.value?.addShape(newShape);
    }

    // Unit placement — requires a unit to be selected in the unit bar
    if (tool === 'unit' && selectedUnit.value) {
      const unit = selectedUnit.value;
      const shapeId = generateShapeId();
      const newShape: UnitShape = {
        id: shapeId,
        type: 'unit',
        color: activeColor.value,
        x: cx,
        y: cy,
        unitId: unit.unitId,
        unitOptions: [],
        thumbnailPath: unit.thumbnailPath,
        label: unit.unitName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      sessionMgr.value?.addShape(newShape);

      // Set default range filter for this unit
      unitRangeFilters.value = { ...unitRangeFilters.value, [shapeId]: { ...DEFAULT_RANGE_FILTER } };

      // Mark as loading
      unitDetailLoading.value = { ...unitDetailLoading.value, [shapeId]: true };

      // Fetch unit detail for range calculation (async, non-blocking)
      fetchUnitDetail(unit.unitId, [])
        .then(detail => {
          // Cache detail data for modification controls
          unitDetailCache.value = { ...unitDetailCache.value, [shapeId]: detail };

          const ranges = calculateUnitRanges(detail);
          if (ranges.length > 0) {
            unitRangeCache.value = { ...unitRangeCache.value, [shapeId]: ranges };
            // Set default altitude filter: only highest-range altitudes enabled
            const defaultAlts = buildDefaultDisabledAltitudes(ranges);
            if (Object.keys(defaultAlts).length > 0) {
              const existing = unitRangeFilters.value[shapeId] ?? { ...DEFAULT_RANGE_FILTER };
              unitRangeFilters.value = { ...unitRangeFilters.value, [shapeId]: { ...existing, disabledWeaponAltitudes: defaultAlts } };
            }
          }
        })
        .catch(err => {
          console.warn('Failed to fetch unit ranges:', err);
        })
        .finally(() => {
          unitDetailLoading.value = { ...unitDetailLoading.value, [shapeId]: false };
        });
    }
  });

  const handleMapSelect = $((map: MapData) => {
    currentMap.value = map;
    showMapSelector.value = false;
    // Reset shapes when changing maps
    sessionMgr.value?.clear();
    selectedIds.value = [];
    unitRangeCache.value = {};
    unitRangeFilters.value = {};
    unitDetailCache.value = {};
    unitDetailLoading.value = {};
    sessionMgr.value?.setMapMetadata(map.key);
  });

  /** Unit lookup modal → user picked a unit */
  const handleUnitSelected = $((unitId: number, unitName: string, thumbnailPath: string) => {
    selectedUnit.value = { unitId, unitName, thumbnailPath };
  });

  /** Clear the selected unit for placement */
  const handleClearUnit = $(() => {
    selectedUnit.value = null;
  });

  // ── Selected unit shape context (for the UnitContextPanel) ──

  /**
   * Derive the selected unit shape (if exactly one unit shape is selected).
   * Used to determine whether to show the context panel.
   */
  const selectedUnitShape = useComputed$(() => {
    const ids = selectedIds.value;
    if (ids.length !== 1) return null;
    const shape = shapes.value.find(s => s.id === ids[0]);
    if (!shape || !isUnitShape(shape)) return null;
    return shape as UnitShape;
  });

  /** Signal wrapper for the selected shape's range filter — needed as a prop */
  const selectedRangeFilter = useSignal<UnitRangeFilter>({ ...DEFAULT_RANGE_FILTER });

  /**
   * Sync selectedRangeFilter from the per-unit filter store whenever
   * the selected unit shape changes.
   */
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const shape = track(() => selectedUnitShape.value);
    if (shape) {
      const filter = unitRangeFilters.value[shape.id];
      if (filter) {
        selectedRangeFilter.value = { ...filter };
      } else {
        selectedRangeFilter.value = { ...DEFAULT_RANGE_FILTER };
      }
    }
  });

  /**
   * When selectedRangeFilter changes, propagate back to the per-unit store
   * and trigger a re-render of filtered ranges.
   */
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const filter = track(() => selectedRangeFilter.value);
    const shape = selectedUnitShape.value;
    if (!shape) return;
    // Update the per-unit filter store
    unitRangeFilters.value = { ...unitRangeFilters.value, [shape.id]: { ...filter } };
  });

  /** Handle icon size change from context panel */
  const handleUnitSizeChange = $((newSize: number) => {
    const shape = selectedUnitShape.value;
    if (!shape) return;
    sessionMgr.value?.updateShape({ ...shape, size: newSize, updatedAt: Date.now() });
  });

  /** Handle modification option change from context panel */
  const handleModOptionChange = $((modId: number, optionId: number) => {
    const shape = selectedUnitShape.value;
    if (!shape) return;

    // Build the new option IDs list from all mod slots
    const detail = unitDetailCache.value[shape.id];
    if (!detail) return;

    const newOptionIds = detail.modifications.map(slot =>
      slot.modification.Id === modId ? optionId : slot.selectedOptionId,
    );

    // Update the shape's unitOptions
    sessionMgr.value?.updateShape({ ...shape, unitOptions: newOptionIds, updatedAt: Date.now() });

    // Mark as loading and re-fetch unit detail with new options
    unitDetailLoading.value = { ...unitDetailLoading.value, [shape.id]: true };

    fetchUnitDetail(shape.unitId, newOptionIds)
      .then(newDetail => {
        unitDetailCache.value = { ...unitDetailCache.value, [shape.id]: newDetail };
        const ranges = calculateUnitRanges(newDetail);
        unitRangeCache.value = { ...unitRangeCache.value, [shape.id]: ranges };

        // Re-compute default altitude filter for the new weapon loadout
        const defaultAlts = buildDefaultDisabledAltitudes(ranges);
        const existing = unitRangeFilters.value[shape.id] ?? { ...DEFAULT_RANGE_FILTER };
        unitRangeFilters.value = { ...unitRangeFilters.value, [shape.id]: { ...existing, disabledWeaponAltitudes: defaultAlts } };

        // Update displayName/label if the modification changes it
        if (newDetail.displayName) {
          const currentShape = shapes.value.find(s => s.id === shape.id);
          if (currentShape) {
            sessionMgr.value?.updateShape({ ...currentShape, label: newDetail.displayName, updatedAt: Date.now() });
          }
        }
      })
      .catch(err => {
        console.warn('Failed to re-fetch unit detail after mod change:', err);
      })
      .finally(() => {
        unitDetailLoading.value = { ...unitDetailLoading.value, [shape.id]: false };
      });
  });

  const handleUndo = $(() => {
    sessionMgr.value?.undo();
  });

  const handleRedo = $(() => {
    sessionMgr.value?.redo();
  });

  const handleClear = $(() => {
    if (shapes.value.length === 0) return;
    sessionMgr.value?.clear();
    selectedIds.value = [];
  });

  // ── Session handlers ──
  const handleStartSession = $(() => {
    sessionMgr.value?.startSession();
  });

  const handleJoinSession = $((id: string) => {
    sessionMgr.value?.joinSession(id);
  });

  const handleLeaveSession = $(() => {
    sessionMgr.value?.leaveSession();
  });

  const handleSetUserName = $((name: string) => {
    sessionMgr.value?.setLocalUserName(name);
  });

  return (
    <div class="-mx-4 md:-mx-8 xl:-mx-10 2xl:-mx-12">
      <div class="flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-5rem)]">
        {/* Toolbar row */}
        <div class="shrink-0">
          <MapToolbar
            activeTool={activeTool}
            activeColor={activeColor}
            toggles={toggles}
            onOpenMapSelector$={$(() => { showMapSelector.value = true; })}
            onOpenMarkerBar$={$(() => { showMarkerBar.value = true; })}
            onOpenUnitBar$={$(() => { showUnitLookup.value = true; })}
          />
          <MarkerSelectionBar
            activeMarkerType={activeMarkerType}
            visible={showMarkerBar.value && activeTool.value === 'marker'}
          />
          <UnitSelectionBar
            selectedUnit={selectedUnit}
            visible={activeTool.value === 'unit'}
            onOpenLookup$={$(() => { showUnitLookup.value = true; })}
            onClearUnit$={handleClearUnit}
          />
        </div>

        {/* Main canvas area */}
        <div class="flex-1 relative min-h-0 bg-[#0d0d0d] select-none overflow-hidden">
          {/* Canvas — always mounted; manager handles null map gracefully.
              Avoids Qwik ternary+Fragment DOM reconciliation bug where the
              "else" branch div persists after the condition flips to true,
              leaving an absolute-inset-0 overlay that eats all pointer events. */}
          <MapCanvas
            currentMap={currentMap}
            activeTool={activeTool}
            activeColor={activeColor}
            shapes={shapes}
            toggles={toggles}
            zoom={zoom}
            mouseMeters={mouseMeters}
            mouseScreen={mouseScreen}
            shiftDown={shiftDown}
            selectedIds={selectedIds}
            activeMarkerType={activeMarkerType}
            zoomCommand={zoomCmd}
            unitRangeCache={filteredRangeCache}
            onShapeCreated$={handleShapeCreated}
            onShapeUpdated$={handleShapeUpdated}
            onShapeClick$={handleShapeClick}
            onDeselect$={handleDeselect}
            onPing$={handlePing}
            onCanvasPlace$={handleCanvasPlace}
          />

          {/* Crosshair overlay — always mounted, self-hides when no map */}
          <CrosshairOverlay
            activeTool={activeTool}
            mouseScreen={mouseScreen}
            mouseMeters={mouseMeters}
            hasMap={!!currentMap.value}
          />

          {/* Empty state overlay — shown only when no map is selected */}
          {!currentMap.value && (
            <div class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="text-[var(--text-dim)] opacity-30">
                <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" />
                <path d="M8 2v16m8-12v16" />
              </svg>
              <p class="text-sm text-[var(--text-dim)] font-mono">{t(i18n, 'maps.selectMap')}</p>
              <button
                class="px-4 py-2 border border-[var(--accent)] text-[var(--accent)] text-xs font-mono tracking-wider uppercase hover:bg-[rgba(70,151,195,0.1)] transition-colors"
                onClick$={() => { showMapSelector.value = true; }}
              >
                {t(i18n, 'maps.selectMap')}
              </button>
            </div>
          )}

          {/* Floating controls — bottom right */}
          <div class="absolute bottom-4 right-4 z-20">
            <MapControls
              zoom={zoom}
              canUndo={canUndo}
              canRedo={canRedo}
              onZoomIn$={$(() => { zoomCmd.value = 'in:' + Date.now(); })}
              onZoomOut$={$(() => { zoomCmd.value = 'out:' + Date.now(); })}
              onFitView$={$(() => { zoomCmd.value = 'fit:' + Date.now(); })}
              onUndo$={handleUndo}
              onRedo$={handleRedo}
              onClear$={handleClear}
            />
          </div>

          {/* Keybind legend — bottom left */}
          <div class="absolute bottom-4 left-4 z-20 w-48">
            <KeybindLegend />
          </div>

          {/* Unit context panel — bottom left, above keybind legend when a unit shape is selected */}
          {selectedUnitShape.value && (
            <div class="absolute top-2 left-2 z-30 max-h-[calc(100%-1rem)] overflow-y-auto">
              <UnitContextPanel
                unitName={selectedUnitShape.value.label || `Unit ${selectedUnitShape.value.unitId}`}
                currentSize={selectedUnitShape.value.size ?? DEFAULT_UNIT_SIZE}
                rangeFilter={selectedRangeFilter}
                opticsStealthConfig={opticsStealthConfig}
                modifications={unitDetailCache.value[selectedUnitShape.value.id]?.modifications ?? []}
                isLoading={unitDetailLoading.value[selectedUnitShape.value.id] ?? false}
                onSizeChange$={handleUnitSizeChange}
                onModOptionChange$={handleModOptionChange}
                weaponNames={getWeaponNamesFromRanges(unitRangeCache.value[selectedUnitShape.value.id] ?? [])}
                weaponAltitudes={getWeaponAltitudesFromRanges(unitRangeCache.value[selectedUnitShape.value.id] ?? [])}
                hasMultiOptics={hasMultipleOptics(unitRangeCache.value[selectedUnitShape.value.id] ?? [])}
              />
            </div>
          )}

          {/* Coordinate readout — top right */}
          {currentMap.value && (
            <div class="absolute top-2 right-2 z-20 px-2 py-1 bg-black/50 text-[9px] font-mono text-[var(--text-dim)] pointer-events-none select-none">
              {Math.round(mouseMeters.value.x)}, {Math.round(mouseMeters.value.y)}{t(i18n, 'maps.coords.meters')}
              <span class="ml-2 opacity-60">{Math.round(zoom.value.scale * 100)}%</span>
            </div>
          )}

          {/* Session controls — top right, below coordinate readout */}
          <div class="absolute top-8 right-2 z-20">
            <ISRSessionControls
              sessionMode={sessionMode}
              sessionId={sessionId}
              sessionUsers={sessionUsers}
              connectionStatus={connectionStatus}
              localUserName={localUserName}
              localClientId={localClientId}
              onStartSession$={handleStartSession}
              onJoinSession$={handleJoinSession}
              onLeaveSession$={handleLeaveSession}
              onSetUserName$={handleSetUserName}
            />
          </div>
        </div>
      </div>

      {/* Map selection modal */}
      <MapSelectionModal
        open={showMapSelector}
        onSelect$={handleMapSelect}
      />

      {/* Unit lookup modal */}
      <UnitLookupModal
        open={showUnitLookup}
        onSelect$={handleUnitSelected}
      />
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Maps & Tactics - BA Hub',
  meta: [
    {
      name: 'description',
      content: 'Interactive strategic map viewer with tactical drawing tools, objective overlays, unit placement, and range visualization for Broken Arrow.',
    },
  ],
};
