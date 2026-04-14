/**
 * Map display name → portrait image path for OG metadata.
 * Uses the map portrait previews from mapsettings/images/portraits/.
 * Keys must match MAP_ID_TO_NAME values in backend/src/graphql/resolvers.ts.
 */
const MAP_NAME_TO_IMAGE: Record<string, string> = {
  'Baltiisk':             '/images/mapsettings/images/portraits/Map_Baltiysk_Preview.png',
  'Coast':                '/images/mapsettings/images/portraits/Map_Coast_Preview.png',
  'Airport':              '/images/mapsettings/images/portraits/Map_Airport_Preview.png',
  'River':                '/images/mapsettings/images/portraits/Map_River_Preview.png',
  'Dam':                  '/images/mapsettings/images/portraits/Map_Dam_Preview.png',
  'Tallinn Harbour':      '/images/mapsettings/images/portraits/Map_Tallin_Preview.png',
  'Airbase':              '/images/mapsettings/images/portraits/Map_Airbase_Preview.png',
  'Frontiers':            '/images/mapsettings/images/portraits/Map_Frontiers_Preview.png',
  'Central Village':      '/images/mapsettings/images/portraits/Map_Village_Preview.png',
  'Oil refinery':         '/images/mapsettings/images/portraits/Map_OilRefinery_Preview.png',
  'Suwalki':              '/images/mapsettings/images/portraits/Map_Suwalki_Preview.png',
  'Jelgava':              '/images/mapsettings/images/portraits/Map_Jelgava_Preview.png',
  'Narva':                '/images/mapsettings/images/portraits/Map_Narva_Preview.png',
  'Klaipeda':             '/images/mapsettings/images/portraits/Map_Klaipeda_Preview.png',
  'Ruda':                 '/images/mapsettings/images/portraits/Map_Ruda_Preview.png',
  'Parnu':                '/images/mapsettings/images/portraits/Map_Parnu_Preview.png',
  'Chernyakhovsk':        '/images/mapsettings/images/portraits/Map_Cherniakhovsk_Preview.png',
  'Ignalina Powerplant':  '/images/mapsettings/images/portraits/Map_Powerplant_Preview.png',
  'Kaliningrad':          '/images/mapsettings/images/portraits/Map_Kaliningrad_Preview.png',
  'Kadaga Military Base': '/images/mapsettings/images/portraits/Map_Kadaga_Preview.png',
};

export function buildMapImageUrl(mapName: string | null): string | null {
  if (!mapName) return null;
  return MAP_NAME_TO_IMAGE[mapName] ?? null;
}
