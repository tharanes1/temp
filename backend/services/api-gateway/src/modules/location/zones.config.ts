/**
 * Operating zones config — single source of truth for v1.
 *
 * Real production data lives in a future `Zone` Prisma model populated by
 * the dispatcher service.  Until then the curated list below covers the
 * Bengaluru launch market and matches what the FE's `OperatingZonesScreen`
 * was previously hardcoding.
 */

export interface ZoneConfig {
  id: string;
  name: string;
  city: string;
  centerCoords: { latitude: number; longitude: number };
  /** Bounding polygon as [lat, lng] pairs (closed ring). */
  polygon: [number, number][];
  /** Fallback demand level when GeoSet density can't be computed. */
  defaultDemandLevel: 'low' | 'medium' | 'high' | 'very_high';
}

export const OPERATING_ZONES: readonly ZoneConfig[] = [
  {
    id: 'zone_blr_koramangala',
    name: 'Koramangala',
    city: 'bengaluru',
    centerCoords: { latitude: 12.935, longitude: 77.625 },
    polygon: [
      [12.92, 77.61],
      [12.92, 77.64],
      [12.95, 77.64],
      [12.95, 77.61],
      [12.92, 77.61],
    ],
    defaultDemandLevel: 'high',
  },
  {
    id: 'zone_blr_indiranagar',
    name: 'Indiranagar',
    city: 'bengaluru',
    centerCoords: { latitude: 12.9716, longitude: 77.6412 },
    polygon: [
      [12.96, 77.625],
      [12.96, 77.66],
      [12.985, 77.66],
      [12.985, 77.625],
      [12.96, 77.625],
    ],
    defaultDemandLevel: 'very_high',
  },
  {
    id: 'zone_blr_mg_road',
    name: 'MG Road',
    city: 'bengaluru',
    centerCoords: { latitude: 12.9716, longitude: 77.5946 },
    polygon: [
      [12.965, 77.585],
      [12.965, 77.605],
      [12.98, 77.605],
      [12.98, 77.585],
      [12.965, 77.585],
    ],
    defaultDemandLevel: 'high',
  },
  {
    id: 'zone_blr_hsr',
    name: 'HSR Layout',
    city: 'bengaluru',
    centerCoords: { latitude: 12.9116, longitude: 77.6473 },
    polygon: [
      [12.895, 77.635],
      [12.895, 77.66],
      [12.93, 77.66],
      [12.93, 77.635],
      [12.895, 77.635],
    ],
    defaultDemandLevel: 'medium',
  },
  {
    id: 'zone_blr_whitefield',
    name: 'Whitefield',
    city: 'bengaluru',
    centerCoords: { latitude: 12.9698, longitude: 77.7499 },
    polygon: [
      [12.95, 77.73],
      [12.95, 77.77],
      [12.99, 77.77],
      [12.99, 77.73],
      [12.95, 77.73],
    ],
    defaultDemandLevel: 'medium',
  },
];
