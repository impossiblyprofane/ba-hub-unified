/**
 * Map display name → votemap image path.
 * Keys must match MAP_ID_TO_NAME values in backend/src/graphql/resolvers.ts.
 * Falls back through: votemap → MapPreview_Color → base thumbnail → null.
 */
const MAP_NAME_TO_IMAGE: Record<string, string> = {
  'Baltiisk':             '/images/maps/Baltiisk_votemap.png',
  'Coast':                '/images/maps/Coast_votemap.png',
  'Airport':              '/images/maps/Airport_votemap.png',
  'River':                '/images/maps/River_votemap.png',
  'Dam':                  '/images/maps/Dam_votemap.png',
  'Tallinn Harbour':      '/images/maps/Tallinn.png',
  'Airbase':              '/images/maps/Airbase_votemap.png',
  'Frontiers':            '/images/maps/Frontiers_votemap.png',
  'Central Village':      '/images/maps/Central_village_votemap.png',
  'Oil refinery':         '/images/maps/OilRefinery_votemap.png',
  'Suwalki':              '/images/maps/Suwalki_MapPreview_Color.png',
  'Jelgava':              '/images/maps/Jelgava.png',
  'Narva':                '/images/maps/Narva.png',
  'Klaipeda':             '/images/maps/Klaipeda_votemap.png',
  'Ruda':                 '/images/maps/Ruda_votemap.png',
  'Parnu':                '/images/maps/Parnu_votemap.png',
  'Chernyakhovsk':        '/images/maps/Chernyakhovsk_votemap.png',
  'Ignalina Powerplant':  '/images/maps/Ignalina_Powerplant_votemap.png',
  'Kaliningrad':          '/images/maps/Kaliningrad_votemap.png',
  'Kadaga Military Base': '/images/maps/KadagaMilitaryBase_votemap.png',
};

export function buildMapImageUrl(mapName: string | null): string | null {
  if (!mapName) return null;
  return MAP_NAME_TO_IMAGE[mapName] ?? null;
}
