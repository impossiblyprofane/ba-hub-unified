// ══════════════════════════════════════════════════════════════
// Maps feature — constants
// ══════════════════════════════════════════════════════════════

import type { MarkerIconDef } from './types';

// ── Coordinate system ──

/** 1 canvas pixel = 15 meters at base scale */
export const PIXELS_TO_METERS = 15;

/** Meters to canvas pixels conversion factor */
export const METERS_TO_PIXELS = 1 / PIXELS_TO_METERS;

/** Map size in the objective coordinate space (9000×9000) */
export const OBJECTIVE_SPACE_SIZE = 9000;

/** Full map size in meters (18000×18000) */
export const MAP_SIZE_METERS = 18000;

/** Full map size in canvas pixels at base scale */
export const MAP_SIZE_PIXELS = MAP_SIZE_METERS / PIXELS_TO_METERS; // 1200

// ── Grid ──

/** Major grid spacing in canvas pixels (1000m intervals) */
export const GRID_MAJOR_SPACING = 1000 / PIXELS_TO_METERS; // ~66.67

/** Minor grid spacing in canvas pixels (100m intervals) */
export const GRID_MINOR_SPACING = 100 / PIXELS_TO_METERS; // ~6.67

export const GRID_MAJOR_COLOR = 'rgba(255, 255, 255, 0.15)';
export const GRID_MINOR_COLOR = 'rgba(255, 255, 255, 0.05)';
export const GRID_MAJOR_WIDTH = 2;
export const GRID_MINOR_WIDTH = 1;

/** Minimum zoom scale at which minor grid lines are visible */
export const GRID_MINOR_VISIBLE_THRESHOLD = 0.5;

// ── Zoom ──

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
export const ZOOM_WHEEL_STEP = 0.1;
export const ZOOM_BUTTON_STEP = 0.1;

/** Fit-to-view fills this percentage of the container */
export const FIT_VIEW_PADDING = 0.8;

// ── Objective rendering ──

export const OBJECTIVE_STYLE = {
  STROKE_WIDTH: 2,
  STROKE_COLOR: 'rgba(255, 255, 255, 0.9)',
  FILL_COLOR: 'rgba(0, 0, 0, 0.3)',
  TEXT_COLOR: 'rgba(255, 255, 255, 1)',
  TEXT_FONT_SIZE: 12,
  TEXT_FONT_FAMILY: 'Arial, sans-serif',
  TEXT_STROKE_WIDTH: 0.5,
  TEXT_STROKE_COLOR: 'rgba(0, 0, 0, 0.8)',
} as const;

// ── Colors ──

/** Full 8-color palette for canvas drawing */
export const TACTICAL_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Yellow', value: '#f59e0b' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'White', value: '#ffffff' },
] as const;

/** 5-color subset for toolbar quick selection */
export const TOOLBAR_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Purple', value: '#a855f7' },
] as const;

/** 10-color palette for collaborative user assignment */
export const USER_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7',
  '#f97316', '#ec4899', '#06b6d4', '#84cc16', '#f43f5e',
] as const;

// ── Range display colors ──

export const RANGE_COLORS = {
  LASER: '#ef4444',
  OPTICS_GROUND: '#16a34a',
  OPTICS_LOW_ALT: '#0891b2',
  OPTICS_HIGH_ALT: '#1d4ed8',
  RADAR_LOW: '#06b6d4',
  RADAR_HIGH: '#7c3aed',
} as const;

/** Cycling colors for ammunition range circles */
export const AMMO_RANGE_COLORS = [
  '#f97316', '#f59e0b', '#eab308', '#84cc16', '#10b981',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
] as const;

// ── Shape defaults ──

export const DEFAULT_LINE_THICKNESS = 2;
export const DEFAULT_ARROW_SIZE = 10;
export const DEFAULT_CIRCLE_OPACITY = 0.3;
export const DEFAULT_MARKER_SIZE = 20;
export const DEFAULT_UNIT_SIZE = 12;

/**
 * Sentinel value for "pin" mode — a small half-diamond marker
 * with the bottom vertex at the unit's exact map coordinate.
 */
export const UNIT_PIN_SIZE = 0;

/** Distance snap increment in meters when Shift is held */
export const SNAP_INCREMENT_METERS = 5;
export const SNAP_INCREMENT_PIXELS = SNAP_INCREMENT_METERS / PIXELS_TO_METERS;

// ── Session / tactical user colors ──

/**
 * 10 distinguishable colors for user assignment in collaborative sessions.
 * Round-robin assigned based on connected client IDs.
 */
export const SESSION_USER_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#eab308', // yellow
] as const;

/** Validate a collaborative session ID (6-8 alphanumeric chars) */
export function isValidSessionId(id: string): boolean {
  return /^[A-Za-z0-9]{6,8}$/.test(id);
}

/** Generate a random 8-character alphanumeric session ID */
export function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ── Selection rendering ──

export const SELECTION_STROKE_COLOR = '#22c55e';
export const SELECTION_STROKE_WIDTH = 1;
export const SELECTION_DASH = [6, 3];
export const SELECTION_HANDLE_SIZE = 8;
export const SELECTION_HANDLE_COLOR = '#22c55e';

// ── Ping ──

export const PING_DURATION_MS = 2000;
export const PING_OUTER_RADIUS = 30;
export const PING_INNER_RADIUS = 20;
export const PING_CENTER_RADIUS = 4;

// ── Marker icons ──

export const MARKER_ICONS: MarkerIconDef[] = [
  // Unit markers
  { id: 'infantry', category: 'unit', iconPath: '/images/ui/MapDrawButton_Inf.png', blurIconPath: '/images/ui/MapDrawButton_Inf_Blur.png', labelKey: 'maps.markers.infantry' },
  { id: 'tank', category: 'unit', iconPath: '/images/ui/MapDrawButton_Tank.png', blurIconPath: '/images/ui/MapDrawButton_Tank_Blur.png', labelKey: 'maps.markers.tank' },
  { id: 'heli', category: 'unit', iconPath: '/images/ui/MapDrawButton_Heli.png', blurIconPath: '/images/ui/MapDrawButton_Heli_Blur.png', labelKey: 'maps.markers.heli' },
  { id: 'jet', category: 'unit', iconPath: '/images/ui/MapDrawButton_Jet.png', blurIconPath: '/images/ui/MapDrawButton_Jet_Blur.png', labelKey: 'maps.markers.jet' },
  { id: 'arty', category: 'unit', iconPath: '/images/ui/MapDrawButton_Arty.png', blurIconPath: '/images/ui/MapDrawButton_Arty_Blur.png', labelKey: 'maps.markers.arty' },
  { id: 'aa', category: 'unit', iconPath: '/images/ui/MapDrawButton_AA.png', labelKey: 'maps.markers.aa' },
  { id: 'recon', category: 'unit', iconPath: '/images/ui/MapDrawButton_Recon.png', blurIconPath: '/images/ui/MapDrawButton_Recon_Blur.png', labelKey: 'maps.markers.recon' },
  { id: 'para', category: 'unit', iconPath: '/images/ui/MapDrawButton_Para.png', blurIconPath: '/images/ui/MapDrawButton_Para_Blur.png', labelKey: 'maps.markers.para' },
  // Objective/ping markers
  { id: 'attack', category: 'objective', iconPath: '/images/ui/Map Ping Marker Attack Icon.png', labelKey: 'maps.markers.attack' },
  { id: 'defense', category: 'objective', iconPath: '/images/ui/Map Ping Marker Defense Icon.png', labelKey: 'maps.markers.defense' },
  { id: 'attention', category: 'objective', iconPath: '/images/ui/Map Ping Marker Attention Icon.png', labelKey: 'maps.markers.attention' },
  { id: 'supply', category: 'objective', iconPath: '/images/ui/Map Ping Marker Supply Icon.png', labelKey: 'maps.markers.supply' },
];

// ── Keybinds ──

export interface KeybindDef {
  key: string;
  actionKey: string;
}

export const KEYBINDS: KeybindDef[] = [
  { key: 'Space', actionKey: 'maps.keybinds.pan' },
  { key: '1', actionKey: 'maps.keybinds.select' },
  { key: '2', actionKey: 'maps.keybinds.arrow' },
  { key: '3', actionKey: 'maps.keybinds.line' },
  { key: '4', actionKey: 'maps.keybinds.circle' },
  { key: '5', actionKey: 'maps.keybinds.marker' },
  { key: '6', actionKey: 'maps.keybinds.unit' },
  { key: 'Shift', actionKey: 'maps.keybinds.snap' },
  { key: 'Q', actionKey: 'maps.keybinds.toggleObjectives' },
  { key: 'W', actionKey: 'maps.keybinds.toggleRanges' },
  { key: 'E', actionKey: 'maps.keybinds.toggleMarkers' },
  { key: 'R', actionKey: 'maps.keybinds.toggleUnits' },
  { key: 'A', actionKey: 'maps.keybinds.cycleColor' },
  { key: 'Ctrl+Z', actionKey: 'maps.keybinds.undo' },
  { key: 'Ctrl+Y', actionKey: 'maps.keybinds.redo' },
  { key: 'Ctrl+C', actionKey: 'maps.keybinds.copy' },
  { key: 'Ctrl+V', actionKey: 'maps.keybinds.paste' },
  { key: 'Scroll', actionKey: 'maps.keybinds.zoom' },
  { key: 'Del', actionKey: 'maps.keybinds.delete' },
  { key: 'Esc', actionKey: 'maps.keybinds.deselect' },
];

// ── Tool definitions ──

export interface ToolDef {
  id: string;
  keybind: string;
  labelKey: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'pan', keybind: 'Space', labelKey: 'maps.tools.pan' },
  { id: 'select', keybind: '1', labelKey: 'maps.tools.select' },
  { id: 'arrow', keybind: '2', labelKey: 'maps.tools.arrow' },
  { id: 'line', keybind: '3', labelKey: 'maps.tools.line' },
  { id: 'circle', keybind: '4', labelKey: 'maps.tools.circle' },
  { id: 'marker', keybind: '5', labelKey: 'maps.tools.marker' },
  { id: 'unit', keybind: '6', labelKey: 'maps.tools.unit' },
];
