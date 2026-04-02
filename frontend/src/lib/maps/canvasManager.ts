// ══════════════════════════════════════════════════════════════
// MapCanvasManager — vanilla Konva wrapper for the ISR canvas
// ══════════════════════════════════════════════════════════════
//
// This class owns the Konva Stage and all layers. It is instantiated
// inside a Qwik useVisibleTask$ and controlled via method calls.
// Events flow back to the Qwik component via callback functions.
//
// Layer stack (bottom → top):
//   1. mapLayer       — map image
//   2. gridLayer      — major/minor grid lines
//   3. objectiveLayer — capture zone overlays
//   4. shapeLayer     — user-drawn shapes (lines, circles, markers, units)
//   5. uiLayer        — selection handles, drawing preview, pings
//
// ══════════════════════════════════════════════════════════════

import Konva from 'konva';
import type {
  ZoomState,
  MapData,
  MapObjective,
  Shape,
  LineShape,
  CircleShape,
  MarkerShape,
  UnitShape,
  DisplayToggles,
  Point,
  ISRTool,
  RangeCircle,
} from './types';
import {
  isLineShape,
  isCircleShape,
  isMarkerShape,
  isUnitShape,
  getLineDistanceMeters,
} from './types';
import {
  PIXELS_TO_METERS,
  METERS_TO_PIXELS,
  OBJECTIVE_SPACE_SIZE,
  MAP_SIZE_PIXELS,
  GRID_MAJOR_SPACING,
  GRID_MINOR_SPACING,
  GRID_MAJOR_COLOR,
  GRID_MINOR_COLOR,
  GRID_MAJOR_WIDTH,
  GRID_MINOR_WIDTH,
  GRID_MINOR_VISIBLE_THRESHOLD,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_WHEEL_STEP,
  FIT_VIEW_PADDING,
  OBJECTIVE_STYLE,
  DEFAULT_LINE_THICKNESS,
  DEFAULT_ARROW_SIZE,
  DEFAULT_CIRCLE_OPACITY,
  DEFAULT_MARKER_SIZE,
  DEFAULT_UNIT_SIZE,
  SELECTION_STROKE_COLOR,
  SELECTION_STROKE_WIDTH,
  SELECTION_DASH,
  SELECTION_HANDLE_SIZE,
  SELECTION_HANDLE_COLOR,
  SNAP_INCREMENT_PIXELS,
  PING_DURATION_MS,
  PING_OUTER_RADIUS,
  PING_INNER_RADIUS,
  PING_CENTER_RADIUS,
} from './constants';

// ── Callback types ──

export interface CanvasCallbacks {
  /** Mouse position changed (canvas coords, meters) */
  onMouseMove?: (canvasX: number, canvasY: number, metersX: number, metersY: number, screenX: number, screenY: number) => void;
  /** Shape was clicked (for selection) */
  onShapeClick?: (shapeId: string, addToSelection: boolean) => void;
  /** Empty area was clicked (deselect) */
  onCanvasClick?: (canvasX: number, canvasY: number) => void;
  /** Drawing completed — new shape data */
  onShapeCreated?: (shape: Shape) => void;
  /** Existing shape was moved or resized */
  onShapeUpdated?: (shape: Shape) => void;
  /** Right-click for ping */
  onPing?: (canvasX: number, canvasY: number) => void;
  /** Zoom changed */
  onZoomChange?: (zoom: ZoomState) => void;
}

// ── Main class ──

export class MapCanvasManager {
  private stage: Konva.Stage;
  private mapLayer: Konva.Layer;
  private gridLayer: Konva.Layer;
  private objectiveLayer: Konva.Layer;
  private shapeLayer: Konva.Layer;
  private uiLayer: Konva.Layer;

  private zoom: ZoomState = { x: 0, y: 0, scale: 1 };
  private containerWidth = 0;
  private containerHeight = 0;
  private resizeObserver: ResizeObserver | null = null;

  private mapImage: Konva.Image | null = null;

  private callbacks: CanvasCallbacks = {};
  private shapeNodes = new Map<string, Konva.Group>();
  private selectionIds: Set<string> = new Set();
  private selectionGroup: Konva.Group | null = null;

  // Drawing state
  private activeTool: ISRTool = 'select';
  private activeColor = '#ef4444';
  private isDrawing = false;
  private drawStart: Point | null = null;
  private previewNode: Konva.Group | null = null;
  private isPanning = false;
  private panStart: Point | null = null;
  private isShiftDown = false;

  // Drag/resize state for shape manipulation
  private isDraggingShape = false;
  private dragShapeId: string | null = null;
  private dragStartCanvas: Point | null = null;
  private isResizingShape = false;
  private resizeShapeId: string | null = null;
  private resizeHandleType: string | null = null;
  private resizePreviewNode: Konva.Group | null = null;
  private resizeOriginalNode: Konva.Group | null = null;

  // Shapes data reference for lookups during interaction
  private shapesData: Shape[] = [];

  // Cache for marker/unit images
  private imageCache = new Map<string, HTMLImageElement>();

  constructor(container: HTMLDivElement, callbacks?: CanvasCallbacks) {
    this.callbacks = callbacks || {};

    const rect = container.getBoundingClientRect();
    this.containerWidth = rect.width;
    this.containerHeight = rect.height;

    this.stage = new Konva.Stage({
      container,
      width: this.containerWidth,
      height: this.containerHeight,
    });

    // Create layers in render order
    this.mapLayer = new Konva.Layer({ listening: false });
    this.gridLayer = new Konva.Layer({ listening: false });
    this.objectiveLayer = new Konva.Layer({ listening: false });
    this.shapeLayer = new Konva.Layer();
    this.uiLayer = new Konva.Layer();

    this.stage.add(this.mapLayer);
    this.stage.add(this.gridLayer);
    this.stage.add(this.objectiveLayer);
    this.stage.add(this.shapeLayer);
    this.stage.add(this.uiLayer);

    // Bind events
    this.bindEvents();

    // Observe container resize
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this.containerWidth = width;
          this.containerHeight = height;
          this.stage.width(width);
          this.stage.height(height);
          this.renderGrid();
        }
      }
    });
    this.resizeObserver.observe(container);
  }

  // ═══════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════

  /** Load + display a map */
  loadMap(mapData: MapData): void {
    this.clearMapImage();

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.mapImage = new Konva.Image({
        image: img,
        x: 0,
        y: 0,
        width: MAP_SIZE_PIXELS,
        height: MAP_SIZE_PIXELS,
        listening: false,
      });
      this.mapLayer.add(this.mapImage);
      this.applyZoomToLayer(this.mapLayer);
      this.mapLayer.batchDraw();

      // Fit to view on first load
      this.fitToView();

      // Render objectives if available
      if (mapData.objectives) {
        this.renderObjectives(mapData.objectives, mapData.objectiveOffset);
      }
    };
    img.src = mapData.image.main;
  }

  /** Set the active tool */
  setTool(tool: ISRTool): void {
    this.activeTool = tool;
    this.cancelDrawing();
    if (this.isDraggingShape) this.cancelDrag();
    if (this.isResizingShape) this.cancelResize();
    this.updateCursor();
  }

  /** Set the active drawing color */
  setColor(color: string): void {
    this.activeColor = color;
  }

  /** Set selected shape IDs (renders selection visuals) */
  setSelection(ids: string[]): void {
    this.selectionIds = new Set(ids);
    this.renderSelection();
  }

  /** Update display toggles (objective layer visibility only; shape visibility is handled by renderShapes) */
  setDisplayToggles(toggles: DisplayToggles): void {
    this.objectiveLayer.visible(toggles.objectives);
    this.objectiveLayer.batchDraw();
  }

  /** Render an array of shapes (from Yjs or local state) */
  renderShapes(shapes: Shape[], toggles?: DisplayToggles): void {
    this.shapesData = shapes;

    // Remove old nodes not in new set
    const newIds = new Set(shapes.map(s => s.id));
    for (const [id, node] of this.shapeNodes) {
      if (!newIds.has(id)) {
        node.destroy();
        this.shapeNodes.delete(id);
      }
    }

    // Create/update each shape
    for (const shape of shapes) {
      // Apply visibility toggles
      if (toggles) {
        if (isMarkerShape(shape) && !toggles.markers) {
          this.removeShapeNode(shape.id);
          continue;
        }
        if (isUnitShape(shape) && !toggles.units) {
          this.removeShapeNode(shape.id);
          continue;
        }
      }
      this.renderShape(shape);
    }

    this.applyZoomToLayer(this.shapeLayer);
    this.shapeLayer.batchDraw();
    this.renderSelection();
  }

  /** Render range circles for a unit at a position */
  renderUnitRanges(unitId: string, x: number, y: number, ranges: RangeCircle[]): void {
    // Remove existing range group for this unit
    const existingId = `ranges_${unitId}`;
    const existing = this.uiLayer.findOne(`#${existingId}`);
    if (existing) existing.destroy();

    const group = new Konva.Group({ id: existingId });

    // Sort ranges by radius descending so largest draws first (painter order)
    const sorted = [...ranges].sort((a, b) => b.radiusMeters - a.radiusMeters);

    // ── Draw circles ──
    for (const range of sorted) {
      const pixelRadius = range.radiusMeters * METERS_TO_PIXELS;
      group.add(new Konva.Circle({
        x, y,
        radius: pixelRadius,
        stroke: range.color,
        strokeWidth: 0.8,
        dash: [8, 4],
        opacity: 0.7,
        fill: 'transparent',
        listening: false,
      }));
    }

    // ── Place labels — anchored to each ring, collision-bumped only when needed ──
    const fontSize = 8;
    const labelHeight = fontSize + 3; // row height for collision detection
    const padding = 4;               // gap between ring edge and label
    const maxLabelChars = 28;        // truncate long labels

    // Process from outermost to innermost (highest on screen → lowest).
    // Track the lowest available Y so inner labels only bump when they'd overlap.
    let ceilingY = -Infinity; // lowest Y already occupied (screen coords go down)

    for (const range of sorted) {
      const pixelRadius = range.radiusMeters * METERS_TO_PIXELS;
      let rawLabel = `${Math.round(range.radiusMeters)}m ${range.label}`;
      // Truncate excessively long labels
      if (rawLabel.length > maxLabelChars) {
        rawLabel = rawLabel.slice(0, maxLabelChars - 1) + '…';
      }
      const labelText = rawLabel;
      const approxWidth = labelText.length * fontSize * 0.6;

      // Natural position: just above this ring's top edge
      let labelY = y - pixelRadius - padding - fontSize;

      // If this label would overlap the one above it, push it down to sit
      // right below the previous label (i.e. keep the ceiling).
      // "ceilingY" is the bottom edge of the last placed label.
      if (ceilingY > -Infinity && labelY < ceilingY + 2) {
        labelY = ceilingY + 2;
      }

      ceilingY = labelY + labelHeight;

      // Dark outline for readability over any background
      group.add(new Konva.Text({
        x,
        y: labelY,
        text: labelText,
        fontSize,
        fontFamily: 'monospace',
        fill: range.color,
        stroke: 'rgba(0,0,0,0.7)',
        strokeWidth: 2,
        lineJoin: 'round',
        listening: false,
        offsetX: approxWidth / 2,
      }));
      // Crisp fill on top
      group.add(new Konva.Text({
        x,
        y: labelY,
        text: labelText,
        fontSize,
        fontFamily: 'monospace',
        fill: range.color,
        listening: false,
        offsetX: approxWidth / 2,
      }));
    }

    this.uiLayer.add(group);
    this.applyZoomToLayer(this.uiLayer);
    this.uiLayer.batchDraw();
  }

  /** Clear range circles for a unit */
  clearUnitRanges(unitId: string): void {
    const existing = this.uiLayer.findOne(`#ranges_${unitId}`);
    if (existing) {
      existing.destroy();
      this.uiLayer.batchDraw();
    }
  }

  /** Animate a ping at canvas coordinates */
  showPing(canvasX: number, canvasY: number, color: string, senderName?: string): void {
    const group = new Konva.Group({ x: canvasX, y: canvasY });

    const outer = new Konva.Circle({ radius: 0, stroke: color, strokeWidth: 2, listening: false });
    const inner = new Konva.Circle({ radius: 0, stroke: color, strokeWidth: 1.5, listening: false });
    const center = new Konva.Circle({ radius: PING_CENTER_RADIUS, fill: color, listening: false });

    group.add(outer, inner, center);

    if (senderName) {
      group.add(new Konva.Text({
        x: PING_CENTER_RADIUS + 6,
        y: -6,
        text: senderName,
        fontSize: 11,
        fontFamily: 'monospace',
        fill: color,
        listening: false,
      }));
    }

    this.uiLayer.add(group);
    this.applyZoomToLayer(this.uiLayer);

    // Animate
    const startTime = Date.now();
    const anim = new Konva.Animation((_frame) => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / PING_DURATION_MS, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      outer.radius(PING_OUTER_RADIUS * ease);
      inner.radius(PING_INNER_RADIUS * ease);

      const fadeProgress = Math.max(0, (progress - 0.5) * 2);
      const opacity = 1 - fadeProgress;
      group.opacity(opacity);

      if (progress >= 1) {
        anim.stop();
        group.destroy();
        this.uiLayer.batchDraw();
      }
    }, this.uiLayer);

    anim.start();
  }

  /** Zoom to fit the map in the viewport */
  fitToView(): void {
    if (!this.containerWidth || !this.containerHeight) return;

    const scaleX = (this.containerWidth * FIT_VIEW_PADDING) / MAP_SIZE_PIXELS;
    const scaleY = (this.containerHeight * FIT_VIEW_PADDING) / MAP_SIZE_PIXELS;
    const scale = Math.min(scaleX, scaleY);

    const x = (this.containerWidth - MAP_SIZE_PIXELS * scale) / 2;
    const y = (this.containerHeight - MAP_SIZE_PIXELS * scale) / 2;

    this.setZoom({ x, y, scale });
  }

  /** Zoom in/out by a step (centered on viewport) */
  zoomByStep(direction: 1 | -1): void {
    const centerX = this.containerWidth / 2;
    const centerY = this.containerHeight / 2;
    const newScale = this.clampZoom(this.zoom.scale + direction * ZOOM_WHEEL_STEP);
    this.zoomToPoint(centerX, centerY, newScale);
  }

  /** Get current zoom state */
  getZoom(): ZoomState {
    return { ...this.zoom };
  }

  /** Set shift key state (for snapping) */
  setShiftDown(down: boolean): void {
    this.isShiftDown = down;
  }

  /** Convert screen coordinates to canvas coordinates */
  screenToCanvas(screenX: number, screenY: number): Point {
    return {
      x: (screenX - this.zoom.x) / this.zoom.scale,
      y: (screenY - this.zoom.y) / this.zoom.scale,
    };
  }

  /** Convert canvas coordinates to meters */
  canvasToMeters(canvasX: number, canvasY: number): Point {
    return {
      x: canvasX * PIXELS_TO_METERS,
      y: canvasY * PIXELS_TO_METERS,
    };
  }

  /** Get container dimensions */
  getContainerSize(): { width: number; height: number } {
    return { width: this.containerWidth, height: this.containerHeight };
  }

  /** Cleanup and destroy */
  destroy(): void {
    this.resizeObserver?.disconnect();
    this.stage.destroy();
    this.imageCache.clear();
  }

  // ═══════════════════════════════════════════════════════
  // Zoom management
  // ═══════════════════════════════════════════════════════

  private setZoom(zoom: ZoomState): void {
    this.zoom = zoom;
    this.applyZoomToAllLayers();
    this.renderGrid();
    this.callbacks.onZoomChange?.(zoom);
  }

  private zoomToPoint(screenX: number, screenY: number, newScale: number): void {
    const scaleDiff = newScale / this.zoom.scale;
    this.setZoom({
      x: screenX - (screenX - this.zoom.x) * scaleDiff,
      y: screenY - (screenY - this.zoom.y) * scaleDiff,
      scale: newScale,
    });
  }

  private clampZoom(scale: number): number {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
  }

  private applyZoomToAllLayers(): void {
    this.applyZoomToLayer(this.mapLayer);
    this.applyZoomToLayer(this.gridLayer);
    this.applyZoomToLayer(this.objectiveLayer);
    this.applyZoomToLayer(this.shapeLayer);
    this.applyZoomToLayer(this.uiLayer);
  }

  private applyZoomToLayer(layer: Konva.Layer): void {
    layer.setAttrs({
      x: this.zoom.x,
      y: this.zoom.y,
      scaleX: this.zoom.scale,
      scaleY: this.zoom.scale,
    });
    layer.batchDraw();
  }

  // ═══════════════════════════════════════════════════════
  // Grid rendering
  // ═══════════════════════════════════════════════════════

  private renderGrid(): void {
    this.gridLayer.destroyChildren();

    const { x, y, scale } = this.zoom;

    // Calculate visible bounds in canvas coordinates
    const left = -x / scale;
    const top = -y / scale;
    const right = left + this.containerWidth / scale;
    const bottom = top + this.containerHeight / scale;

    // Clamp to map bounds (with small margin)
    const gridLeft = Math.max(0, left);
    const gridTop = Math.max(0, top);
    const gridRight = Math.min(MAP_SIZE_PIXELS, right);
    const gridBottom = Math.min(MAP_SIZE_PIXELS, bottom);

    // Major grid lines
    const majorStartX = Math.floor(gridLeft / GRID_MAJOR_SPACING) * GRID_MAJOR_SPACING;
    const majorStartY = Math.floor(gridTop / GRID_MAJOR_SPACING) * GRID_MAJOR_SPACING;

    for (let gx = majorStartX; gx <= gridRight; gx += GRID_MAJOR_SPACING) {
      this.gridLayer.add(new Konva.Line({
        points: [gx, gridTop, gx, gridBottom],
        stroke: GRID_MAJOR_COLOR,
        strokeWidth: GRID_MAJOR_WIDTH / scale,
        listening: false,
      }));
    }
    for (let gy = majorStartY; gy <= gridBottom; gy += GRID_MAJOR_SPACING) {
      this.gridLayer.add(new Konva.Line({
        points: [gridLeft, gy, gridRight, gy],
        stroke: GRID_MAJOR_COLOR,
        strokeWidth: GRID_MAJOR_WIDTH / scale,
        listening: false,
      }));
    }

    // Minor grid lines (only when zoomed in enough)
    if (scale >= GRID_MINOR_VISIBLE_THRESHOLD) {
      const minorStartX = Math.floor(gridLeft / GRID_MINOR_SPACING) * GRID_MINOR_SPACING;
      const minorStartY = Math.floor(gridTop / GRID_MINOR_SPACING) * GRID_MINOR_SPACING;

      for (let gx = minorStartX; gx <= gridRight; gx += GRID_MINOR_SPACING) {
        // Skip major grid positions
        if (Math.abs(gx % GRID_MAJOR_SPACING) < 0.01) continue;
        this.gridLayer.add(new Konva.Line({
          points: [gx, gridTop, gx, gridBottom],
          stroke: GRID_MINOR_COLOR,
          strokeWidth: GRID_MINOR_WIDTH / scale,
          listening: false,
        }));
      }
      for (let gy = minorStartY; gy <= gridBottom; gy += GRID_MINOR_SPACING) {
        if (Math.abs(gy % GRID_MAJOR_SPACING) < 0.01) continue;
        this.gridLayer.add(new Konva.Line({
          points: [gridLeft, gy, gridRight, gy],
          stroke: GRID_MINOR_COLOR,
          strokeWidth: GRID_MINOR_WIDTH / scale,
          listening: false,
        }));
      }
    }

    this.applyZoomToLayer(this.gridLayer);
  }

  // ═══════════════════════════════════════════════════════
  // Map image
  // ═══════════════════════════════════════════════════════

  private clearMapImage(): void {
    if (this.mapImage) {
      this.mapImage.destroy();
      this.mapImage = null;
    }
    this.objectiveLayer.destroyChildren();
  }

  // ═══════════════════════════════════════════════════════
  // Objective rendering
  // ═══════════════════════════════════════════════════════

  private renderObjectives(objectives: MapObjective[], offset?: { x: number; y: number }): void {
    this.objectiveLayer.destroyChildren();

    const group = new Konva.Group();

    for (const obj of objectives) {
      const ox = obj.position.x + (offset?.x || 0);
      const oy = obj.position.y + (offset?.y || 0);

      // Convert from 9000×9000 space to canvas pixels
      // Y-axis is inverted, then scale from 9000→18000→canvas
      const canvasX = (ox * 2) / PIXELS_TO_METERS;
      const canvasY = ((OBJECTIVE_SPACE_SIZE - oy) * 2) / PIXELS_TO_METERS;
      const scaleToCanvas = (v: number) => (v * 2) / PIXELS_TO_METERS;

      const objGroup = new Konva.Group({ x: canvasX, y: canvasY });

      if (obj.type === 'circle') {
        const radius = ((obj.scale.x + obj.scale.y) / 2) / 4 * 2 / PIXELS_TO_METERS;
        objGroup.add(new Konva.Circle({
          radius,
          stroke: OBJECTIVE_STYLE.STROKE_COLOR,
          strokeWidth: OBJECTIVE_STYLE.STROKE_WIDTH / this.zoom.scale,
          fill: OBJECTIVE_STYLE.FILL_COLOR,
          listening: false,
        }));
      } else {
        // Box
        const w = scaleToCanvas(obj.scale.x);
        const h = scaleToCanvas(obj.scale.y);
        objGroup.add(new Konva.Rect({
          x: -w / 2,
          y: -h / 2,
          width: w,
          height: h,
          rotation: obj.rotation || 0,
          stroke: OBJECTIVE_STYLE.STROKE_COLOR,
          strokeWidth: OBJECTIVE_STYLE.STROKE_WIDTH / this.zoom.scale,
          fill: OBJECTIVE_STYLE.FILL_COLOR,
          listening: false,
        }));
      }

      // Label (always upright)
      objGroup.add(new Konva.Text({
        text: obj.name,
        fontSize: OBJECTIVE_STYLE.TEXT_FONT_SIZE / this.zoom.scale,
        fontFamily: OBJECTIVE_STYLE.TEXT_FONT_FAMILY,
        fill: OBJECTIVE_STYLE.TEXT_COLOR,
        stroke: OBJECTIVE_STYLE.TEXT_STROKE_COLOR,
        strokeWidth: OBJECTIVE_STYLE.TEXT_STROKE_WIDTH / this.zoom.scale,
        align: 'center',
        verticalAlign: 'middle',
        offsetX: obj.name.length * 3.5,
        offsetY: 6,
        listening: false,
      }));

      group.add(objGroup);
    }

    this.objectiveLayer.add(group);
    this.applyZoomToLayer(this.objectiveLayer);
  }

  // ═══════════════════════════════════════════════════════
  // Shape rendering
  // ═══════════════════════════════════════════════════════

  private renderShape(shape: Shape): void {
    // Remove old version
    this.removeShapeNode(shape.id);

    const group = new Konva.Group({ id: shape.id, name: 'shape' });

    if (isLineShape(shape)) {
      this.renderLineShape(group, shape);
    } else if (isCircleShape(shape)) {
      this.renderCircleShape(group, shape);
    } else if (isMarkerShape(shape)) {
      this.renderMarkerShape(group, shape);
    } else if (isUnitShape(shape)) {
      this.renderUnitShapeNode(group, shape);
    }

    // Cursor management for select tool
    group.on('mouseenter', () => {
      if (this.activeTool === 'select' && !this.isDraggingShape && !this.isResizingShape) {
        this.stage.container().style.cursor = 'move';
      }
    });
    group.on('mouseleave', () => {
      if (this.activeTool === 'select' && !this.isDraggingShape && !this.isResizingShape) {
        this.stage.container().style.cursor = 'default';
      }
    });

    this.shapeLayer.add(group);
    this.shapeNodes.set(shape.id, group);
  }

  private renderLineShape(group: Konva.Group, shape: LineShape): void {
    const thickness = shape.thickness ?? DEFAULT_LINE_THICKNESS;
    const isArrow = shape.type === 'arrow';
    const [x1, y1, x2, y2] = shape.points;

    const lineConfig: Konva.LineConfig = {
      points: shape.points,
      stroke: shape.color,
      strokeWidth: thickness,
      dash: shape.dashed ? [8, 4] : undefined,
      hitStrokeWidth: 10,
    };

    if (isArrow) {
      const arrowSize = shape.arrowSize ?? DEFAULT_ARROW_SIZE;
      group.add(new Konva.Arrow({
        ...lineConfig,
        points: shape.points as number[],
        pointerLength: arrowSize,
        pointerWidth: arrowSize,
        fill: shape.color,
      }));
    } else {
      group.add(new Konva.Line(lineConfig));
    }

    // ── Endpoint dots for measurement clarity ──
    group.add(new Konva.Circle({
      x: x1, y: y1,
      radius: 3,
      fill: shape.color,
      listening: false,
    }));
    group.add(new Konva.Circle({
      x: x2, y: y2,
      radius: 3,
      fill: shape.color,
      listening: false,
    }));

    // ── Distance label at midpoint with background ──
    const dist = getLineDistanceMeters(shape, PIXELS_TO_METERS);
    if (dist > 0) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const text = `${Math.round(dist)}m`;
      const labelW = text.length * 7 + 8;

      // Offset label perpendicular to the line so it doesn't overlap
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = -dy / len * 12;
      const perpY = dx / len * 12;

      group.add(new Konva.Rect({
        x: midX + perpX - labelW / 2,
        y: midY + perpY - 8,
        width: labelW,
        height: 16,
        fill: 'rgba(0,0,0,0.7)',
        cornerRadius: 2,
        listening: false,
      }));
      group.add(new Konva.Text({
        x: midX + perpX - labelW / 2 + 4,
        y: midY + perpY - 5,
        text,
        fontSize: 11,
        fontFamily: 'monospace',
        fill: shape.color,
        listening: false,
      }));
    }
  }

  private renderCircleShape(group: Konva.Group, shape: CircleShape): void {
    const opacity = shape.opacity ?? DEFAULT_CIRCLE_OPACITY;

    // Fill circle
    group.add(new Konva.Circle({
      x: shape.x,
      y: shape.y,
      radius: shape.radius,
      stroke: shape.color,
      strokeWidth: 2,
      dash: shape.dashed ? [8, 4] : undefined,
      fill: shape.fill || 'transparent',
      opacity,
      hitStrokeWidth: 10,
    }));

    // ── Center crosshair (+) ──
    const ch = 8; // half-length of each arm in canvas pixels
    group.add(new Konva.Line({
      points: [shape.x - ch, shape.y, shape.x + ch, shape.y],
      stroke: shape.color,
      strokeWidth: 1.5,
      listening: false,
    }));
    group.add(new Konva.Line({
      points: [shape.x, shape.y - ch, shape.x, shape.y + ch],
      stroke: shape.color,
      strokeWidth: 1.5,
      listening: false,
    }));

    // ── Small center dot ──
    group.add(new Konva.Circle({
      x: shape.x,
      y: shape.y,
      radius: 2.5,
      fill: shape.color,
      listening: false,
    }));

    // ── Radius line (center → right edge) ──
    group.add(new Konva.Line({
      points: [shape.x, shape.y, shape.x + shape.radius, shape.y],
      stroke: shape.color,
      strokeWidth: 1,
      dash: [4, 3],
      opacity: 0.6,
      listening: false,
    }));

    // ── Range label with background ──
    const meters = shape.radius * PIXELS_TO_METERS;
    const text = `${Math.round(meters)}m`;
    const labelX = shape.x + shape.radius + 6;
    const labelY = shape.y - 8;
    group.add(new Konva.Rect({
      x: labelX - 3,
      y: labelY - 2,
      width: text.length * 7 + 8,
      height: 16,
      fill: 'rgba(0,0,0,0.7)',
      cornerRadius: 2,
      listening: false,
    }));
    group.add(new Konva.Text({
      x: labelX + 1,
      y: labelY + 1,
      text,
      fontSize: 11,
      fontFamily: 'monospace',
      fill: shape.color,
      listening: false,
    }));
  }

  private renderMarkerShape(group: Konva.Group, shape: MarkerShape): void {
    const size = shape.size ?? DEFAULT_MARKER_SIZE;

    // Dark background circle
    group.add(new Konva.Circle({
      x: shape.x,
      y: shape.y,
      radius: size / 2 + 3,
      fill: 'rgba(0,0,0,0.6)',
      stroke: shape.color,
      strokeWidth: 1.5,
    }));

    // Try to load icon image
    if (shape.icon) {
      this.loadImage(shape.icon, (img) => {
        group.add(new Konva.Image({
          image: img,
          x: shape.x - size / 2,
          y: shape.y - size / 2,
          width: size,
          height: size,
          listening: false,
        }));
        this.shapeLayer.batchDraw();
      });
    } else {
      // Fallback: colored circle
      group.add(new Konva.Circle({
        x: shape.x,
        y: shape.y,
        radius: size / 3,
        fill: shape.color,
        listening: false,
      }));
    }

    // Label
    if (shape.label) {
      group.add(new Konva.Text({
        x: shape.x - 20,
        y: shape.y + size / 2 + 4,
        text: shape.label,
        fontSize: 10,
        fontFamily: 'monospace',
        fill: shape.color,
        align: 'center',
        width: 40,
        listening: false,
      }));
    }
  }

  private renderUnitShapeNode(group: Konva.Group, shape: UnitShape): void {
    const size = shape.size ?? DEFAULT_UNIT_SIZE;

    // ── Pin mode: triangle with bottom point at (x, y) ──
    if (size === 0) {
      const pinW = 9;   // half-width at the flat top edge
      const pinH = 14;  // total height from top edge to bottom point
      // Triangle vertices: top-left, top-right, bottom (anchor)
      const points = [
        shape.x - pinW, shape.y - pinH,  // top-left
        shape.x + pinW, shape.y - pinH,  // top-right
        shape.x, shape.y,                // bottom (anchor)
      ];

      // Dark fill
      group.add(new Konva.Line({
        points,
        closed: true,
        fill: 'rgba(0,0,0,0.65)',
        strokeEnabled: false,
      }));

      // Colour border
      group.add(new Konva.Line({
        points,
        closed: true,
        stroke: shape.color,
        strokeWidth: 1.2,
        opacity: 0.7,
        fillEnabled: false,
        listening: false,
      }));

      // Small centre dot at the anchor point for precise reference
      group.add(new Konva.Circle({
        x: shape.x,
        y: shape.y,
        radius: 1.5,
        fill: shape.color,
        listening: false,
      }));

      // Unit thumbnail inside the triangle — fitted into the upper portion
      if (shape.thumbnailPath) {
        const normalised = shape.thumbnailPath.replace(/\\/g, '/').toUpperCase();
        const thumbSrc = `/images/labels/icons/${normalised}.png`;
        const iconSize = 10;
        const iconCX = shape.x;
        const iconCY = shape.y - pinH * 0.58;  // centred in upper third
        this.loadImage(thumbSrc, (img) => {
          const natW = img.naturalWidth || img.width || 1;
          const natH = img.naturalHeight || img.height || 1;
          const aspect = natW / natH;
          let drawW: number;
          let drawH: number;
          if (aspect >= 1) {
            drawW = iconSize;
            drawH = iconSize / aspect;
          } else {
            drawH = iconSize;
            drawW = iconSize * aspect;
          }

          // Clip to the triangle so the image doesn't overflow
          const clipGroup = new Konva.Group({
            clipFunc: (ctx) => {
              ctx.beginPath();
              ctx.moveTo(shape.x - pinW, shape.y - pinH);  // top-left
              ctx.lineTo(shape.x + pinW, shape.y - pinH);  // top-right
              ctx.lineTo(shape.x, shape.y);                 // bottom
              ctx.closePath();
            },
            listening: false,
          });
          clipGroup.add(new Konva.Image({
            image: img,
            x: iconCX - drawW / 2,
            y: iconCY - drawH / 2,
            width: drawW,
            height: drawH,
            listening: false,
          }));
          group.add(clipGroup);
          this.shapeLayer.batchDraw();
        });
      }

      // Label below the pin
      if (shape.label) {
        group.add(new Konva.Text({
          x: shape.x - 40,
          y: shape.y + 3,
          text: shape.label,
          fontSize: 7,
          fontFamily: 'monospace',
          fill: shape.color,
          align: 'center',
          width: 80,
          listening: false,
        }));
      }
      return;
    }

    // ── Normal icon modes (S / M / L / XL) ──

    // Circular background — fill only, no stroke
    const radius = size / 2 + 3;
    group.add(new Konva.Circle({
      x: shape.x,
      y: shape.y,
      radius,
      fill: 'rgba(0,0,0,0.55)',
      strokeEnabled: false,
    }));
    // Colour border ring — reduced opacity so RGBYP colours feel softer
    group.add(new Konva.Circle({
      x: shape.x,
      y: shape.y,
      radius,
      stroke: shape.color,
      strokeWidth: 1.5,
      opacity: 0.45,
      fillEnabled: false,
      listening: false,
    }));

    // Try to load unit thumbnail image — preserve aspect ratio within the circle
    if (shape.thumbnailPath) {
      const normalised = shape.thumbnailPath.replace(/\\/g, '/').toUpperCase();
      const thumbSrc = `/images/labels/icons/${normalised}.png`;
      this.loadImage(thumbSrc, (img) => {
        // Compute aspect-fitted dimensions inside the available diameter
        const natW = img.naturalWidth || img.width || 1;
        const natH = img.naturalHeight || img.height || 1;
        const aspect = natW / natH;
        let drawW: number;
        let drawH: number;
        if (aspect >= 1) {
          drawW = size;
          drawH = size / aspect;
        } else {
          drawH = size;
          drawW = size * aspect;
        }
        group.add(new Konva.Image({
          image: img,
          x: shape.x - drawW / 2,
          y: shape.y - drawH / 2,
          width: drawW,
          height: drawH,
          listening: false,
        }));
        this.shapeLayer.batchDraw();
      });
    }

    // Label below the icon
    if (shape.label) {
      group.add(new Konva.Text({
        x: shape.x - 40,
        y: shape.y + radius + 2,
        text: shape.label,
        fontSize: 9,
        fontFamily: 'monospace',
        fill: shape.color,
        align: 'center',
        width: 80,
        listening: false,
      }));
    }
  }

  private removeShapeNode(id: string): void {
    const node = this.shapeNodes.get(id);
    if (node) {
      node.destroy();
      this.shapeNodes.delete(id);
    }
  }

  // ═══════════════════════════════════════════════════════
  // Selection rendering
  // ═══════════════════════════════════════════════════════

  private renderSelection(): void {
    if (this.selectionGroup) {
      this.selectionGroup.destroy();
      this.selectionGroup = null;
    }

    if (this.selectionIds.size === 0) return;

    // Don't render selection visuals during active drag/resize
    if (this.isDraggingShape || this.isResizingShape) return;

    this.selectionGroup = new Konva.Group({ name: 'selection' });
    const hs = SELECTION_HANDLE_SIZE / this.zoom.scale;
    const sw = SELECTION_STROKE_WIDTH / this.zoom.scale;

    for (const id of this.selectionIds) {
      const node = this.shapeNodes.get(id);
      if (!node) continue;

      const shape = this.shapesData.find(s => s.id === id);
      if (!shape) continue;

      // Compute a tight bounding rect from the core geometry only,
      // ignoring decorative text labels that inflate the Konva group rect.
      const rect = this.getShapeGeometryRect(shape);
      const padding = 4;

      this.selectionGroup.add(new Konva.Rect({
        x: rect.x - padding,
        y: rect.y - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        stroke: SELECTION_STROKE_COLOR,
        strokeWidth: sw,
        dash: SELECTION_DASH.map(v => v / this.zoom.scale),
        listening: false,
      }));

      // Shape-specific interactive resize handles
      if (isCircleShape(shape)) {
        // Edge handle at the right side of the circle (drag to resize radius)
        this.addResizeHandle(shape.id, 'edge', shape.x + shape.radius, shape.y, hs);
      } else if (isLineShape(shape)) {
        const [x1, y1, x2, y2] = shape.points;
        // Start endpoint handle
        this.addResizeHandle(shape.id, 'start', x1, y1, hs);
        // End endpoint handle
        this.addResizeHandle(shape.id, 'end', x2, y2, hs);
      }
      // Markers and units: move-only, no resize handles
    }

    this.uiLayer.add(this.selectionGroup);
    this.applyZoomToLayer(this.uiLayer);
    this.uiLayer.batchDraw();
  }

  /**
   * Compute a bounding rectangle from the shape's core geometry only,
   * ignoring decorative text labels, range labels, etc.
   */
  private getShapeGeometryRect(shape: Shape): { x: number; y: number; width: number; height: number } {
    if (isLineShape(shape)) {
      const [x1, y1, x2, y2] = shape.points;
      const minX = Math.min(x1, x2);
      const minY = Math.min(y1, y2);
      const maxX = Math.max(x1, x2);
      const maxY = Math.max(y1, y2);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    if (isCircleShape(shape)) {
      return {
        x: shape.x - shape.radius,
        y: shape.y - shape.radius,
        width: shape.radius * 2,
        height: shape.radius * 2,
      };
    }
    if (isMarkerShape(shape)) {
      const size = shape.size ?? DEFAULT_MARKER_SIZE;
      const r = size / 2 + 3; // background circle radius
      return { x: shape.x - r, y: shape.y - r, width: r * 2, height: r * 2 };
    }
    if (isUnitShape(shape)) {
      const size = shape.size ?? DEFAULT_UNIT_SIZE;
      if (size === 0) {
        // Pin mode bounds — triangle is 18px wide × 14px tall, bottom vertex at (x,y)
        const pinW = 9;
        const pinH = 14;
        return { x: shape.x - pinW, y: shape.y - pinH, width: pinW * 2, height: pinH };
      }
      const r = size / 2 + 3; // matches radius in renderUnitShapeNode
      return { x: shape.x - r, y: shape.y - r, width: r * 2, height: r * 2 };
    }
    // Fallback — shouldn't reach here
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  private addResizeHandle(shapeId: string, handleType: string, x: number, y: number, size: number): void {
    if (!this.selectionGroup) return;
    const cursor = handleType === 'edge' ? 'ew-resize' : 'crosshair';
    const handle = new Konva.Rect({
      id: `${shapeId}:${handleType}`,
      name: 'resize-handle',
      x: x - size / 2,
      y: y - size / 2,
      width: size,
      height: size,
      fill: SELECTION_HANDLE_COLOR,
      stroke: '#ffffff',
      strokeWidth: 1 / this.zoom.scale,
      hitStrokeWidth: 8 / this.zoom.scale,
      listening: true,
    });
    handle.on('mouseenter', () => {
      this.stage.container().style.cursor = cursor;
    });
    handle.on('mouseleave', () => {
      if (this.activeTool === 'select' && !this.isResizingShape) {
        this.stage.container().style.cursor = 'default';
      }
    });
    this.selectionGroup.add(handle);
  }

  // ═══════════════════════════════════════════════════════
  // Event handling
  // ═══════════════════════════════════════════════════════

  private bindEvents(): void {
    const stage = this.stage;

    // Wheel zoom
    stage.on('wheel', (e) => {
      e.evt.preventDefault();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = this.clampZoom(this.zoom.scale + direction * ZOOM_WHEEL_STEP);
      this.zoomToPoint(pointer.x, pointer.y, newScale);
    });

    // Mouse move — track position + handle drawing/panning
    stage.on('mousemove', (_e) => {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const canvas = this.screenToCanvas(pointer.x, pointer.y);
      const meters = this.canvasToMeters(canvas.x, canvas.y);
      this.callbacks.onMouseMove?.(canvas.x, canvas.y, meters.x, meters.y, pointer.x, pointer.y);

      if (this.isPanning && this.panStart) {
        const dx = pointer.x - this.panStart.x;
        const dy = pointer.y - this.panStart.y;
        this.panStart = { x: pointer.x, y: pointer.y };
        this.setZoom({
          x: this.zoom.x + dx,
          y: this.zoom.y + dy,
          scale: this.zoom.scale,
        });
        return;
      }

      // Shape dragging
      if (this.isDraggingShape && this.dragShapeId && this.dragStartCanvas) {
        const dx = canvas.x - this.dragStartCanvas.x;
        const dy = canvas.y - this.dragStartCanvas.y;
        const node = this.shapeNodes.get(this.dragShapeId);
        if (node) {
          node.position({ x: dx, y: dy });
          this.shapeLayer.batchDraw();
        }
        this.stage.container().style.cursor = 'grabbing';
        return;
      }

      // Shape resizing
      if (this.isResizingShape && this.resizeShapeId) {
        this.updateResizePreview(canvas);
        this.stage.container().style.cursor = this.resizeHandleType === 'edge' ? 'ew-resize' : 'crosshair';
        return;
      }

      if (this.isDrawing && this.drawStart) {
        this.updateDrawPreview(canvas);
      }
    });

    // Mouse down
    stage.on('mousedown', (e) => {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const canvas = this.screenToCanvas(pointer.x, pointer.y);

      // Middle mouse always pans
      if (e.evt.button === 1) {
        e.evt.preventDefault();
        this.isPanning = true;
        this.panStart = { x: pointer.x, y: pointer.y };
        return;
      }

      // Right click → ping
      if (e.evt.button === 2) {
        e.evt.preventDefault();
        this.callbacks.onPing?.(canvas.x, canvas.y);
        return;
      }

      // Left click
      if (e.evt.button === 0) {
        if (this.activeTool === 'pan') {
          this.isPanning = true;
          this.panStart = { x: pointer.x, y: pointer.y };
          return;
        }

        if (this.activeTool === 'select') {
          this.handleSelectClick(e, canvas);
          return;
        }

        // Drawing tools
        if (['arrow', 'line', 'circle'].includes(this.activeTool)) {
          this.isDrawing = true;
          this.drawStart = canvas;
          this.createDrawPreview(canvas);
          return;
        }

        // Instant-place tools
        if (this.activeTool === 'marker' || this.activeTool === 'unit') {
          this.callbacks.onCanvasClick?.(canvas.x, canvas.y);
          return;
        }
      }
    });

    // Mouse up
    stage.on('mouseup', (e) => {
      if (e.evt.button === 1 || (e.evt.button === 0 && this.isPanning)) {
        this.isPanning = false;
        this.panStart = null;
        return;
      }

      // Finalize shape drag
      if (this.isDraggingShape && this.dragShapeId) {
        const pointer = stage.getPointerPosition();
        if (pointer) {
          const canvas = this.screenToCanvas(pointer.x, pointer.y);
          this.finalizeDrag(canvas);
        } else {
          this.cancelDrag();
        }
        return;
      }

      // Finalize shape resize
      if (this.isResizingShape && this.resizeShapeId) {
        const pointer = stage.getPointerPosition();
        if (pointer) {
          const canvas = this.screenToCanvas(pointer.x, pointer.y);
          this.finalizeResize(canvas);
        } else {
          this.cancelResize();
        }
        return;
      }

      if (this.isDrawing && this.drawStart) {
        const pointer = stage.getPointerPosition();
        if (pointer) {
          const canvas = this.screenToCanvas(pointer.x, pointer.y);
          this.finalizeDrawing(canvas);
        }
        this.isDrawing = false;
        this.drawStart = null;
        this.clearPreview();
      }
    });

    // Context menu prevention
    stage.on('contextmenu', (e) => {
      e.evt.preventDefault();
    });
  }

  private handleSelectClick(e: Konva.KonvaEventObject<MouseEvent>, canvas: Point): void {
    const target = e.target;

    // 1. Check if clicked on a resize handle
    if (target.name() === 'resize-handle') {
      const handleId = target.id();
      const colonIdx = handleId.lastIndexOf(':');
      if (colonIdx !== -1) {
        const shapeId = handleId.substring(0, colonIdx);
        const handleType = handleId.substring(colonIdx + 1);

        this.isResizingShape = true;
        this.resizeShapeId = shapeId;
        this.resizeHandleType = handleType;

        // Hide original shape and selection, show resize preview
        const node = this.shapeNodes.get(shapeId);
        if (node) {
          this.resizeOriginalNode = node;
          node.visible(false);
          this.shapeLayer.batchDraw();
        }
        if (this.selectionGroup) {
          this.selectionGroup.visible(false);
          this.uiLayer.batchDraw();
        }
        this.createResizePreview(canvas);
        return;
      }
    }

    // 2. Check if clicked on a shape
    const shapeGroup = target?.findAncestor('.shape', true) as Konva.Group | null;
    if (shapeGroup) {
      const id = shapeGroup.id();
      if (id) {
        // Select if not already selected
        const addToSelection = e.evt.ctrlKey || e.evt.metaKey;
        if (!this.selectionIds.has(id) || addToSelection) {
          // Optimistic local selection update
          if (addToSelection) {
            if (this.selectionIds.has(id)) {
              this.selectionIds.delete(id);
            } else {
              this.selectionIds.add(id);
            }
          } else {
            this.selectionIds = new Set([id]);
          }
          this.callbacks.onShapeClick?.(id, addToSelection);
        }

        // Start drag
        this.isDraggingShape = true;
        this.dragShapeId = id;
        this.dragStartCanvas = canvas;

        // Hide selection handles during drag
        if (this.selectionGroup) {
          this.selectionGroup.visible(false);
          this.uiLayer.batchDraw();
        }
        return;
      }
    }

    // 3. Clicked on empty space — deselect
    this.callbacks.onCanvasClick?.(canvas.x, canvas.y);
  }

  // ═══════════════════════════════════════════════════════
  // Shape drag & resize
  // ═══════════════════════════════════════════════════════

  private finalizeDrag(current: Point): void {
    if (!this.dragShapeId || !this.dragStartCanvas) { this.cancelDrag(); return; }

    const shape = this.shapesData.find(s => s.id === this.dragShapeId);
    if (!shape) { this.cancelDrag(); return; }

    const dx = current.x - this.dragStartCanvas.x;
    const dy = current.y - this.dragStartCanvas.y;

    // Reset the group offset applied during drag
    const node = this.shapeNodes.get(this.dragShapeId);
    if (node) node.position({ x: 0, y: 0 });

    const id = this.dragShapeId;
    this.isDraggingShape = false;
    this.dragShapeId = null;
    this.dragStartCanvas = null;

    // Skip if negligible movement (treat as click-select only)
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      this.shapeLayer.batchDraw();
      this.renderSelection();
      this.updateCursor();
      return;
    }

    const updated = this.applyMoveDelta(shape, dx, dy);

    // Optimistic re-render with updated coordinates
    this.renderShape(updated);
    this.shapeLayer.batchDraw();

    // Update local data reference
    const idx = this.shapesData.findIndex(s => s.id === id);
    if (idx >= 0) this.shapesData[idx] = updated;

    this.renderSelection();
    this.updateCursor();
    this.callbacks.onShapeUpdated?.(updated);
  }

  private cancelDrag(): void {
    if (this.dragShapeId) {
      const node = this.shapeNodes.get(this.dragShapeId);
      if (node) node.position({ x: 0, y: 0 });
    }
    this.isDraggingShape = false;
    this.dragShapeId = null;
    this.dragStartCanvas = null;
    this.shapeLayer.batchDraw();
    this.renderSelection();
    this.updateCursor();
  }

  private createResizePreview(current: Point): void {
    this.clearResizePreview();
    const shape = this.shapesData.find(s => s.id === this.resizeShapeId);
    if (!shape || !this.resizeHandleType) return;

    this.resizePreviewNode = new Konva.Group({ name: 'resize-preview' });
    const updated = this.applyResize(shape, this.resizeHandleType, current);

    if (isLineShape(updated)) this.renderLineShape(this.resizePreviewNode, updated);
    else if (isCircleShape(updated)) this.renderCircleShape(this.resizePreviewNode, updated);

    this.uiLayer.add(this.resizePreviewNode);
    this.applyZoomToLayer(this.uiLayer);
    this.uiLayer.batchDraw();
  }

  private updateResizePreview(current: Point): void {
    if (!this.resizePreviewNode || !this.resizeShapeId || !this.resizeHandleType) return;
    this.resizePreviewNode.destroyChildren();

    const shape = this.shapesData.find(s => s.id === this.resizeShapeId);
    if (!shape) return;

    const updated = this.applyResize(shape, this.resizeHandleType, current);

    if (isLineShape(updated)) this.renderLineShape(this.resizePreviewNode, updated);
    else if (isCircleShape(updated)) this.renderCircleShape(this.resizePreviewNode, updated);

    this.uiLayer.batchDraw();
  }

  private finalizeResize(current: Point): void {
    if (!this.resizeShapeId || !this.resizeHandleType) { this.cancelResize(); return; }

    const shape = this.shapesData.find(s => s.id === this.resizeShapeId);
    if (!shape) { this.cancelResize(); return; }

    const updated = this.applyResize(shape, this.resizeHandleType, current);
    const id = this.resizeShapeId;

    // Clear resize state
    this.clearResizePreview();
    this.isResizingShape = false;
    this.resizeShapeId = null;
    this.resizeHandleType = null;

    // Re-show original node, then replace with updated
    if (this.resizeOriginalNode) {
      this.resizeOriginalNode.visible(true);
      this.resizeOriginalNode = null;
    }
    this.renderShape(updated);
    this.shapeLayer.batchDraw();

    // Update local data reference
    const idx = this.shapesData.findIndex(s => s.id === id);
    if (idx >= 0) this.shapesData[idx] = updated;

    this.renderSelection();
    this.updateCursor();
    this.callbacks.onShapeUpdated?.(updated);
  }

  private cancelResize(): void {
    this.clearResizePreview();
    if (this.resizeOriginalNode) {
      this.resizeOriginalNode.visible(true);
      this.resizeOriginalNode = null;
    }
    this.isResizingShape = false;
    this.resizeShapeId = null;
    this.resizeHandleType = null;
    this.shapeLayer.batchDraw();
    this.renderSelection();
    this.updateCursor();
  }

  private clearResizePreview(): void {
    if (this.resizePreviewNode) {
      this.resizePreviewNode.destroy();
      this.resizePreviewNode = null;
    }
  }

  private applyMoveDelta(shape: Shape, dx: number, dy: number): Shape {
    const now = Date.now();
    if (isLineShape(shape)) {
      const [x1, y1, x2, y2] = shape.points;
      return { ...shape, points: [x1 + dx, y1 + dy, x2 + dx, y2 + dy], updatedAt: now };
    }
    if (isCircleShape(shape)) return { ...shape, x: shape.x + dx, y: shape.y + dy, updatedAt: now };
    if (isMarkerShape(shape)) return { ...shape, x: shape.x + dx, y: shape.y + dy, updatedAt: now };
    if (isUnitShape(shape)) return { ...shape, x: shape.x + dx, y: shape.y + dy, updatedAt: now };
    return shape;
  }

  private applyResize(shape: Shape, handleType: string, current: Point): Shape {
    const now = Date.now();
    if (isCircleShape(shape) && handleType === 'edge') {
      const dx = current.x - shape.x;
      const dy = current.y - shape.y;
      let newRadius = Math.max(5, Math.sqrt(dx * dx + dy * dy));
      if (this.isShiftDown) {
        const m = newRadius * PIXELS_TO_METERS;
        newRadius = Math.round(m / 5) * 5 * METERS_TO_PIXELS;
      }
      return { ...shape, radius: newRadius, updatedAt: now };
    }
    if (isLineShape(shape)) {
      const [x1, y1, x2, y2] = shape.points;
      if (handleType === 'start') {
        return { ...shape, points: [current.x, current.y, x2, y2], updatedAt: now };
      }
      if (handleType === 'end') {
        return { ...shape, points: [x1, y1, current.x, current.y], updatedAt: now };
      }
    }
    return shape;
  }

  // ═══════════════════════════════════════════════════════
  // Drawing preview (ephemeral shapes while mouse is held)
  // ═══════════════════════════════════════════════════════

  private createDrawPreview(_start: Point): void {
    this.clearPreview();
    this.previewNode = new Konva.Group({ name: 'preview' });
    this.uiLayer.add(this.previewNode);
  }

  private updateDrawPreview(current: Point): void {
    if (!this.previewNode || !this.drawStart) return;
    this.previewNode.destroyChildren();

    let endX = current.x;
    let endY = current.y;

    // Snap if shift held
    if (this.isShiftDown) {
      endX = Math.round(endX / SNAP_INCREMENT_PIXELS) * SNAP_INCREMENT_PIXELS;
      endY = Math.round(endY / SNAP_INCREMENT_PIXELS) * SNAP_INCREMENT_PIXELS;
    }

    const startX = this.drawStart.x;
    const startY = this.drawStart.y;

    if (this.activeTool === 'arrow' || this.activeTool === 'line') {
      const isArrow = this.activeTool === 'arrow';
      const lineConfig: Konva.LineConfig = {
        points: [startX, startY, endX, endY],
        stroke: this.activeColor,
        strokeWidth: DEFAULT_LINE_THICKNESS,
        opacity: 0.6,
        listening: false,
      };

      if (isArrow) {
        this.previewNode.add(new Konva.Arrow({
          ...lineConfig,
          points: [startX, startY, endX, endY],
          pointerLength: DEFAULT_ARROW_SIZE,
          pointerWidth: DEFAULT_ARROW_SIZE,
          fill: this.activeColor,
        }));
      } else {
        this.previewNode.add(new Konva.Line(lineConfig));
      }

      // Endpoint dots
      this.previewNode.add(new Konva.Circle({
        x: startX, y: startY, radius: 3 / this.zoom.scale,
        fill: this.activeColor, opacity: 0.8, listening: false,
      }));
      this.previewNode.add(new Konva.Circle({
        x: endX, y: endY, radius: 3 / this.zoom.scale,
        fill: this.activeColor, opacity: 0.8, listening: false,
      }));

      // Distance label — perpendicular offset
      const dx = endX - startX;
      const dy = endY - startY;
      const dist = Math.sqrt(dx * dx + dy * dy) * PIXELS_TO_METERS;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = -dy / len * (12 / this.zoom.scale);
      const perpY = dx / len * (12 / this.zoom.scale);
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      const text = `${Math.round(dist)}m`;
      const labelW = text.length * (7 / this.zoom.scale) + 8 / this.zoom.scale;

      this.previewNode.add(new Konva.Rect({
        x: midX + perpX - labelW / 2,
        y: midY + perpY - 8 / this.zoom.scale,
        width: labelW,
        height: 16 / this.zoom.scale,
        fill: 'rgba(0,0,0,0.7)',
        cornerRadius: 2,
        listening: false,
      }));
      this.previewNode.add(new Konva.Text({
        x: midX + perpX - labelW / 2 + 4 / this.zoom.scale,
        y: midY + perpY - 5 / this.zoom.scale,
        text,
        fontSize: 11 / this.zoom.scale,
        fontFamily: 'monospace',
        fill: this.activeColor,
        listening: false,
      }));
    } else if (this.activeTool === 'circle') {
      const dx = endX - startX;
      const dy = endY - startY;
      let radius = Math.sqrt(dx * dx + dy * dy);

      if (this.isShiftDown) {
        const radiusMeters = radius * PIXELS_TO_METERS;
        const snapped = Math.round(radiusMeters / 5) * 5;
        radius = snapped * METERS_TO_PIXELS;
      }

      // Circle outline
      this.previewNode.add(new Konva.Circle({
        x: startX,
        y: startY,
        radius,
        stroke: this.activeColor,
        strokeWidth: 2,
        dash: [8, 4],
        opacity: 0.6,
        listening: false,
      }));

      // Center crosshair (+)
      const ch = 8 / this.zoom.scale;
      this.previewNode.add(new Konva.Line({
        points: [startX - ch, startY, startX + ch, startY],
        stroke: this.activeColor,
        strokeWidth: 1.5,
        opacity: 0.7,
        listening: false,
      }));
      this.previewNode.add(new Konva.Line({
        points: [startX, startY - ch, startX, startY + ch],
        stroke: this.activeColor,
        strokeWidth: 1.5,
        opacity: 0.7,
        listening: false,
      }));
      // Center dot
      this.previewNode.add(new Konva.Circle({
        x: startX, y: startY,
        radius: 2.5 / this.zoom.scale,
        fill: this.activeColor,
        opacity: 0.8,
        listening: false,
      }));

      // Radius line (center → cursor)
      this.previewNode.add(new Konva.Line({
        points: [startX, startY, startX + radius, startY],
        stroke: this.activeColor,
        strokeWidth: 1,
        dash: [4, 3],
        opacity: 0.5,
        listening: false,
      }));

      // Range label with background
      const meters = radius * PIXELS_TO_METERS;
      const text = `${Math.round(meters)}m`;
      const labelW = text.length * (7 / this.zoom.scale) + 8 / this.zoom.scale;
      const labelX = startX + radius + 6 / this.zoom.scale;
      const labelY = startY - 8 / this.zoom.scale;
      this.previewNode.add(new Konva.Rect({
        x: labelX - 3 / this.zoom.scale,
        y: labelY - 2 / this.zoom.scale,
        width: labelW,
        height: 16 / this.zoom.scale,
        fill: 'rgba(0,0,0,0.7)',
        cornerRadius: 2,
        listening: false,
      }));
      this.previewNode.add(new Konva.Text({
        x: labelX + 1 / this.zoom.scale,
        y: labelY + 1 / this.zoom.scale,
        text,
        fontSize: 11 / this.zoom.scale,
        fontFamily: 'monospace',
        fill: this.activeColor,
        listening: false,
      }));
    }

    this.applyZoomToLayer(this.uiLayer);
    this.uiLayer.batchDraw();
  }

  private finalizeDrawing(end: Point): void {
    if (!this.drawStart) return;

    let endX = end.x;
    let endY = end.y;
    const startX = this.drawStart.x;
    const startY = this.drawStart.y;

    if (this.isShiftDown) {
      endX = Math.round(endX / SNAP_INCREMENT_PIXELS) * SNAP_INCREMENT_PIXELS;
      endY = Math.round(endY / SNAP_INCREMENT_PIXELS) * SNAP_INCREMENT_PIXELS;
    }

    // Minimum distance threshold
    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 2) return;

    if (this.activeTool === 'arrow' || this.activeTool === 'line') {
      const shape: Omit<LineShape, 'id' | 'createdAt' | 'updatedAt'> = {
        type: this.activeTool === 'arrow' ? 'arrow' : 'line',
        points: [startX, startY, endX, endY],
        color: this.activeColor,
        thickness: DEFAULT_LINE_THICKNESS,
      };
      this.callbacks.onShapeCreated?.(this.completeShape(shape) as Shape);
    } else if (this.activeTool === 'circle') {
      let radius = dist;
      if (this.isShiftDown) {
        const radiusMeters = radius * PIXELS_TO_METERS;
        const snapped = Math.round(radiusMeters / 5) * 5;
        radius = snapped * METERS_TO_PIXELS;
      }
      const shape: Omit<CircleShape, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'ring',
        x: startX,
        y: startY,
        radius,
        color: this.activeColor,
      };
      this.callbacks.onShapeCreated?.(this.completeShape(shape) as Shape);
    }
  }

  private completeShape(partial: Record<string, any>): Record<string, any> {
    return {
      ...partial,
      id: `shape_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private clearPreview(): void {
    if (this.previewNode) {
      this.previewNode.destroy();
      this.previewNode = null;
      this.uiLayer.batchDraw();
    }
  }

  private cancelDrawing(): void {
    this.isDrawing = false;
    this.drawStart = null;
    this.clearPreview();
  }

  // ═══════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════

  private loadImage(src: string, callback: (img: HTMLImageElement) => void): void {
    const cached = this.imageCache.get(src);
    if (cached) {
      callback(cached);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.imageCache.set(src, img);
      callback(img);
    };
    img.onerror = () => {
      // Silently fail — fallback visuals already rendered
    };
    img.src = src;
  }

  private updateCursor(): void {
    const container = this.stage.container();
    switch (this.activeTool) {
      case 'pan':
        container.style.cursor = 'grab';
        break;
      case 'select':
        container.style.cursor = 'default';
        break;
      case 'arrow':
      case 'line':
      case 'circle':
        container.style.cursor = 'crosshair';
        break;
      case 'marker':
      case 'unit':
        container.style.cursor = 'crosshair';
        break;
    }
  }
}
