// ══════════════════════════════════════════════════════════════
// Maps feature — static map configuration
// Frontend-only config (not served via GraphQL)
// ══════════════════════════════════════════════════════════════

import type { MapData } from './types';

/**
 * Build standard image variant paths for a map key.
 * Handles maps with consistent naming: Main.png, _BW.png, _MapPreview_Color.png, _votemap.png
 */
function mapImages(fileName: string, opts?: {
  previewKey?: string;
  votemapKey?: string;
  ext?: string;
}): { main: string; preview: string; votemap: string; capture: string } {
  const base = `/images/maps/${fileName}`;
  const ext = opts?.ext ?? 'png';
  const preview = opts?.previewKey
    ? `/images/maps/${opts.previewKey}_MapPreview_Color.png`
    : `/images/maps/${fileName}_MapPreview_Color.png`;
  const votemap = opts?.votemapKey
    ? `/images/maps/${opts.votemapKey}_votemap.png`
    : `/images/maps/${fileName}_votemap.png`;
  return {
    main: `${base}.${ext}`,
    preview,
    votemap,
    capture: `/images/maps/${fileName}_BW.png`,
  };
}

export const MAPS: MapData[] = [
  {
    id: 1,
    key: 'kaliningrad',
    displayName: 'Kaliningrad',
    image: mapImages('Kaliningrad'),
    size: 'large',
    type: 'urban',
    objectives: [
      { name: 'Alpha', type: 'circle', position: { x: 5697.168, y: 2794.988 }, scale: { x: 140, y: 140 } },
      { name: 'Bravo', type: 'circle', position: { x: 4257.504, y: 3211.949 }, scale: { x: 200, y: 200 } },
      { name: 'Charlie', type: 'circle', position: { x: 4214.242, y: 2767.799 }, scale: { x: 200, y: 200 } },
      { name: 'Delta', type: 'circle', position: { x: 5035.86, y: 3151.754 }, scale: { x: 150, y: 150 } },
      { name: 'Echo', type: 'circle', position: { x: 4872.32, y: 2705.944 }, scale: { x: 150, y: 150 } },
      { name: 'Foxtrot', type: 'box', rotation: 35, position: { x: 6194.031, y: 2129.815 }, scale: { x: 150, y: 150 } },
      { name: 'Golf', type: 'box', rotation: 0, position: { x: 6432.957, y: 3002.37 }, scale: { x: 130, y: 130 } },
      { name: 'Hotel', type: 'box', rotation: 0, position: { x: 5678.347, y: 1898.911 }, scale: { x: 135, y: 135 } },
      { name: 'India', type: 'box', rotation: 0, position: { x: 6250.565, y: 3673.836 }, scale: { x: 160, y: 160 } },
      { name: 'Juliet', type: 'box', rotation: 25, position: { x: 5818.949, y: 3116.459 }, scale: { x: 140, y: 140 } },
      { name: 'Kilo', type: 'box', rotation: 25, position: { x: 5476.017, y: 2456.601 }, scale: { x: 125, y: 125 } },
    ],
    objectiveOffset: { x: 0, y: 1500 },
  },
  {
    id: 2,
    key: 'oilRefinery',
    displayName: 'Oil Refinery',
    image: mapImages('OilRefinery', { previewKey: 'Refinary' }),
    size: 'medium',
    type: 'industrial',
    objectives: [
      { name: 'Alpha', type: 'box', rotation: 70, position: { x: 3833.207, y: 2408.339 }, scale: { x: 150, y: 150 } },
      { name: 'Bravo', type: 'box', rotation: 70, position: { x: 4330.679, y: 3226.77 }, scale: { x: 100, y: 200 } },
      { name: 'Charlie', type: 'box', rotation: 25, position: { x: 4923.008, y: 2445.38 }, scale: { x: 150, y: 250 } },
      { name: 'Delta', type: 'box', rotation: 160, position: { x: 4535.386, y: 2047.565 }, scale: { x: 100, y: 350 } },
      { name: 'Echo', type: 'box', rotation: 160, position: { x: 4200.978, y: 1597.865 }, scale: { x: 150, y: 250 } },
      { name: 'Foxtrot', type: 'box', rotation: 150, position: { x: 4853.359, y: 783.9274 }, scale: { x: 100, y: 200 } },
      { name: 'Golf', type: 'box', rotation: 150, position: { x: 5267.214, y: 1704.288 }, scale: { x: 150, y: 200 } },
    ],
    objectiveOffset: { x: 0, y: 0 },
  },
  {
    id: 3,
    key: 'ruda',
    displayName: 'Ruda',
    image: mapImages('Ruda'),
    size: 'large',
    type: 'rural',
  },
  {
    id: 4,
    key: 'river',
    displayName: 'River',
    image: mapImages('River'),
    size: 'medium',
    type: 'water',
  },
  {
    id: 5,
    key: 'dam',
    displayName: 'Dam',
    image: mapImages('Dam'),
    size: 'medium',
    type: 'industrial',
  },
  {
    id: 6,
    key: 'airport',
    displayName: 'Airport',
    image: mapImages('Airport'),
    size: 'large',
    type: 'urban',
  },
  {
    id: 7,
    key: 'klaipeda',
    displayName: 'Klaipeda',
    image: mapImages('Klaipeda'),
    size: 'large',
    type: 'urban',
  },
  {
    id: 8,
    key: 'baltiisk',
    displayName: 'Baltiisk',
    image: mapImages('Baltiisk'),
    size: 'medium',
    type: 'urban',
  },
  {
    id: 9,
    key: 'chernyakhovsk',
    displayName: 'Chernyakhovsk',
    image: mapImages('Chernyakhovsk'),
    size: 'large',
    type: 'urban',
  },
  {
    id: 10,
    key: 'suwalki',
    displayName: 'Suwalki',
    image: mapImages('Suwalki'),
    size: 'large',
    type: 'rural',
  },
  {
    id: 11,
    key: 'airbase',
    displayName: 'Airbase',
    image: mapImages('Airbase'),
    size: 'large',
    type: 'military',
  },
  {
    id: 12,
    key: 'frontiers',
    displayName: 'Frontiers',
    image: mapImages('Frontiers'),
    size: 'large',
    type: 'rural',
  },
  {
    id: 13,
    key: 'ignalinaPowerPlant',
    displayName: 'Ignalina Power Plant',
    image: mapImages('Ignalina', { votemapKey: 'Ignalina_Powerplant' }),
    size: 'medium',
    type: 'industrial',
  },
  {
    id: 14,
    key: 'centralVillage',
    displayName: 'Central Village',
    image: mapImages('Central_village'),
    size: 'small',
    type: 'rural',
  },
  // ── DLC / newer maps (no objective data yet) ──
  {
    id: 15,
    key: 'coast',
    displayName: 'Coast',
    image: mapImages('Coast'),
    size: 'medium',
    type: 'water',
  },
  {
    id: 16,
    key: 'jelgava',
    displayName: 'Jelgava',
    image: mapImages('Jelgava'),
    size: 'large',
    type: 'urban',
  },
  {
    id: 17,
    key: 'narva',
    displayName: 'Narva',
    image: mapImages('Narva'),
    size: 'large',
    type: 'urban',
  },
  {
    id: 18,
    key: 'parnu',
    displayName: 'Parnu',
    image: mapImages('Parnu'),
    size: 'medium',
    type: 'urban',
  },
  {
    id: 19,
    key: 'tallinn',
    displayName: 'Tallinn',
    image: mapImages('Tallinn'),
    size: 'large',
    type: 'urban',
  },
  {
    id: 20,
    key: 'kadagaMilitaryBase',
    displayName: 'Kadaga Military Base',
    image: mapImages('KadagaMilitaryBase'),
    size: 'large',
    type: 'military',
  },
];

/** Lookup map by key */
export function getMapByKey(key: string): MapData | undefined {
  return MAPS.find(m => m.key === key);
}

/** Lookup map by id */
export function getMapById(id: number): MapData | undefined {
  return MAPS.find(m => m.id === id);
}

/**
 * API display names that differ from MAPS.displayName.
 * Maps external API name → MAPS key for lookup.
 */
const API_NAME_ALIASES: Record<string, string> = {
  'Tallinn Harbour': 'tallinn',
  'Oil refinery': 'oilRefinery',
  'Ignalina Powerplant': 'ignalinaPowerPlant',
};

/** Maps without a votemap asset — fall back to preview. */
const NO_VOTEMAP = new Set(['suwalki', 'tallinn', 'jelgava', 'narva']);

/** Get a map background image path from an API map display name.
 *  Prefers votemap, falls back to preview for maps that lack one. */
export function getMapBackgroundByName(name: string | null): string | null {
  if (!name) return null;
  const aliasKey = API_NAME_ALIASES[name];
  const map = aliasKey
    ? MAPS.find(m => m.key === aliasKey)
    : MAPS.find(m => m.displayName === name);
  if (!map) return null;
  return NO_VOTEMAP.has(map.key) ? map.image.preview : map.image.votemap;
}
