// ══════════════════════════════════════════════════════════════
// Maps feature — type definitions
// Ported from legacy ISR (Interactive Strategic Reconnaissance)
// ══════════════════════════════════════════════════════════════

// ── Map data types ──

export type MapSize = 'small' | 'medium' | 'large';
export type MapType = 'urban' | 'industrial' | 'rural' | 'water' | 'military';

export interface MapImageVariants {
  /** Main full-size map image (1200×1200 px at base) */
  main: string;
  /** Preview thumbnail (for map selection grid) */
  preview: string;
  /** Votemap display image */
  votemap: string;
  /** Capture / screenshot variant */
  capture: string;
}

export interface MapObjective {
  /** NATO alphabet name (Alpha, Bravo, ...) */
  name: string;
  /** Shape type for rendering */
  type: 'circle' | 'box';
  /** Position in 9000×9000 coordinate space */
  position: { x: number; y: number };
  /** Scale (width/height or radius factors) */
  scale: { x: number; y: number };
  /** Rotation in degrees (for box type) */
  rotation?: number;
}

export interface MapData {
  id: number;
  /** Internal key, used for lookups */
  key: string;
  /** Display name key — resolves via game locale or i18n */
  displayName: string;
  /** Image path variants */
  image: MapImageVariants;
  /** Map size category */
  size: MapSize;
  /** Map terrain type */
  type: MapType;
  /** Capture zone objectives (NATO alphabet names) */
  objectives?: MapObjective[];
  /** Offset applied before coordinate transform */
  objectiveOffset?: { x: number; y: number };
}

// ── Point & coordinate types ──

export interface Point {
  x: number;
  y: number;
}

// ── Drawing tool types ──

export type ISRTool = 'pan' | 'select' | 'arrow' | 'line' | 'circle' | 'marker' | 'unit';

// ── Shape types ──

export type ShapeType = 'line' | 'arrow' | 'ring' | 'marker' | 'unit';

export interface BaseShape {
  id: string;
  type: ShapeType;
  color: string;
  dashed?: boolean;
  rotation?: number;
  label?: string;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface LineShape extends BaseShape {
  type: 'line' | 'arrow';
  /** Flat array [x1, y1, x2, y2] in canvas coordinates */
  points: number[];
  thickness?: number;
  arrowSize?: number;
}

export interface CircleShape extends BaseShape {
  type: 'ring';
  x: number;
  y: number;
  radius: number;
  fill?: string;
  opacity?: number;
}

export interface MarkerShape extends BaseShape {
  type: 'marker';
  x: number;
  y: number;
  markerType: MarkerType;
  size?: number;
  icon?: string;
}

export interface UnitShape extends BaseShape {
  type: 'unit';
  x: number;
  y: number;
  /** Display size — width of the icon bounding box in canvas pixels */
  size?: number;
  unitId: number;
  /** Currently selected modification option IDs */
  unitOptions: number[];
  /** Cached thumbnail file path for canvas rendering (e.g. Unit.ThumbnailFileName) */
  thumbnailPath?: string;
}

export type Shape = LineShape | CircleShape | MarkerShape | UnitShape;

// ── Marker types ──

export type MarkerCategory = 'unit' | 'objective';

export type UnitMarkerType =
  | 'infantry'
  | 'tank'
  | 'heli'
  | 'jet'
  | 'arty'
  | 'aa'
  | 'recon'
  | 'para';

export type ObjectiveMarkerType =
  | 'attack'
  | 'defense'
  | 'attention'
  | 'supply';

export type MarkerType = UnitMarkerType | ObjectiveMarkerType;

export interface MarkerIconDef {
  id: MarkerType;
  category: MarkerCategory;
  iconPath: string;
  blurIconPath?: string;
  labelKey: string;
}

// ── Session types ──

export type SessionMode = 'local' | 'collaborative';

export interface MapMetadata {
  mapKey: string;
  createdAt: number;
  lastModified: number;
  createdBy: string | null;
  mode: SessionMode;
  sessionId: string | null;
}

export interface SessionUser {
  clientId: number;
  name: string;
  color: string;
  isHost: boolean;
}

export interface PingData {
  x: number;
  y: number;
  color: string;
  senderId: string;
  senderName: string;
}

/** Aggregate session state exposed to the UI */
export interface SessionState {
  mode: SessionMode;
  sessionId: string | null;
  isHost: boolean;
  users: SessionUser[];
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
}

// ── Display toggle state ──

export interface DisplayToggles {
  objectives: boolean;
  ranges: boolean;
  markers: boolean;
  units: boolean;
}

// ── Zoom state ──

export interface ZoomState {
  x: number;
  y: number;
  scale: number;
}

// ── Range display ──

export type RangeCategory = 'weapon' | 'optics' | 'laser';

/** Optics sub-type identifier for per-band collapsing */
export type OpticsType = 'G' | 'L' | 'H' | 'RL' | 'RH';

export interface RangeCircle {
  label: string;
  radiusMeters: number;
  color: string;
  /** Category for filtering — weapons, optics, or laser */
  category: RangeCategory;
  /** For weapon ranges: the weapon HUDName (enables per-weapon filtering) */
  weaponName?: string;
  /** For weapon ranges: which altitude band this range covers */
  altitudeType?: 'ground' | 'lowAlt' | 'highAlt';
  /** For optics ranges: which optics band (G/L/H/RL/RH) */
  opticsType?: OpticsType;
}

/** Per-unit range category visibility toggles */
export interface UnitRangeFilter {
  weapons: boolean;
  optics: boolean;
  laser: boolean;
  /** Per-weapon enable/disable. Key = weapon HUDName, value = enabled. Missing = enabled. */
  disabledWeapons?: string[];
  /** Per-weapon altitude disabling. Key = weaponName, value = disabled altitude types ('ground'|'lowAlt'|'highAlt'). Missing key = all enabled. */
  disabledWeaponAltitudes?: Record<string, string[]>;
  /** When true, show all optics bands (G/L/H/RL/RH); when false, show only the longest-range band */
  showAllOptics?: boolean;
}

// ── Optics stealth simulation ──

/** Terrain cover that multiplies target stealth (makes units harder to detect) */
export type TerrainCover = 'none' | 'forest' | 'building';

/** Terrain cover multiplier — divides effective optics range */
export const TERRAIN_COVER_MULTIPLIER: Record<TerrainCover, number> = {
  none: 1,
  forest: 2,
  building: 3,
};

/** Predefined enemy stealth values — lower = stealthier, higher = more visible */
export const STEALTH_PRESETS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;
export type StealthPreset = typeof STEALTH_PRESETS[number];

/**
 * Global optics stealth configuration.
 * Applied to all optics range circles to simulate detection vs a target
 * with a given stealth profile in a given terrain.
 *
 * Formula: effective_range = base_optics / (stealth × terrain_multiplier)
 * Higher stealth = stealthier target = shorter detection range.
 */
export interface OpticsStealthConfig {
  /** Target stealth multiplier (0.75–3). Default 1 = no modifier. */
  stealth: StealthPreset;
  /** Terrain cover the target is in. Default 'none'. */
  terrain: TerrainCover;
}

export const DEFAULT_OPTICS_STEALTH: OpticsStealthConfig = {
  stealth: 1,
  terrain: 'none',
};

// ── Type guards ──

export function isLineShape(shape: Shape): shape is LineShape {
  return shape.type === 'line' || shape.type === 'arrow';
}

export function isCircleShape(shape: Shape): shape is CircleShape {
  return shape.type === 'ring';
}

export function isMarkerShape(shape: Shape): shape is MarkerShape {
  return shape.type === 'marker';
}

export function isUnitShape(shape: Shape): shape is UnitShape {
  return shape.type === 'unit';
}

// ── Shape utilities ──

let _idCounter = 0;

export function generateShapeId(): string {
  return `shape_${Date.now()}_${++_idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getShapeCenter(shape: Shape): Point {
  if (isLineShape(shape)) {
    const [x1, y1, x2, y2] = shape.points;
    return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  }
  if (isCircleShape(shape) || isMarkerShape(shape) || isUnitShape(shape)) {
    return { x: shape.x, y: shape.y };
  }
  return { x: 0, y: 0 };
}

export function getShapeBounds(shape: Shape): { x: number; y: number; width: number; height: number } {
  if (isLineShape(shape)) {
    const [x1, y1, x2, y2] = shape.points;
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    return { x: minX, y: minY, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
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
    const s = shape.size ?? 20;
    return { x: shape.x - s / 2, y: shape.y - s / 2, width: s, height: s };
  }
  if (isUnitShape(shape)) {
    const s = shape.size ?? 20;
    return { x: shape.x - s / 2, y: shape.y - s / 2, width: s, height: s };
  }
  return { x: 0, y: 0, width: 0, height: 0 };
}

/** Calculate distance in meters for line shapes */
export function getLineDistanceMeters(shape: LineShape, pixelsToMeters: number): number {
  const [x1, y1, x2, y2] = shape.points;
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy) * pixelsToMeters;
}

/** Calculate radius in meters for circle shapes */
export function getCircleRadiusMeters(shape: CircleShape, pixelsToMeters: number): number {
  return shape.radius * pixelsToMeters;
}
