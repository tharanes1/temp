/**
 * Location service.
 *
 *   • /geocode             Redis-cached 1h reverse geocode.  External API
 *                          integration (Google Maps / OSM) is a follow-up;
 *                          today we return a structured stub keyed off the
 *                          PIN-code prefix table for Indian states.
 *
 *   • /operating-zones     Static config (`zones.config.ts`) with live demand
 *                          counts overlaid from the rider GeoSet.  Cached
 *                          for 3 minutes (spec §5.8).
 *
 *   • /heatmap             Aggregates `cravix:rider:locations` GeoSet inside
 *                          the requested bounds.  Cached for 60 s.
 */
import { logger } from '@cravix/shared-logger';
import { cacheAside, prefixKey, redis, RedisKeys } from '@cravix/shared-redis';

import { OPERATING_ZONES, type ZoneConfig } from './zones.config.js';
import type { GeocodeDto, HeatmapPointDto, OperatingZoneDto } from './types.js';

const GEOCODE_CACHE_TTL = 60 * 60;
const ZONES_CACHE_TTL = 180;
const HEATMAP_CACHE_TTL = 60;

// ─── PIN-code prefix → state (subset of the rider-app's table) ─────────────
const PIN_PREFIX_TO_STATE: Record<string, string> = {
  '11': 'Delhi',
  '40': 'Maharashtra',
  '41': 'Maharashtra',
  '42': 'Maharashtra',
  '56': 'Karnataka',
  '57': 'Karnataka',
  '58': 'Karnataka',
  '59': 'Karnataka',
  '60': 'Tamil Nadu',
  '61': 'Tamil Nadu',
  '62': 'Tamil Nadu',
  '70': 'West Bengal',
};

// ─── Geocode (stub) ─────────────────────────────────────────────

function pinFromCoords(lat: number, lng: number): string {
  // Coarse heuristic: closest known city centroid → use its representative PIN.
  const KNOWN: { lat: number; lng: number; pincode: string }[] = [
    { lat: 12.9716, lng: 77.5946, pincode: '560001' },
    { lat: 19.076, lng: 72.8777, pincode: '400001' },
    { lat: 28.6139, lng: 77.209, pincode: '110001' },
    { lat: 13.0827, lng: 80.2707, pincode: '600001' },
    { lat: 22.5726, lng: 88.3639, pincode: '700001' },
  ];
  let best = KNOWN[0]!;
  let bestD = Number.POSITIVE_INFINITY;
  for (const k of KNOWN) {
    const d = Math.hypot(k.lat - lat, k.lng - lng);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best.pincode;
}

// ─── Helpers ────────────────────────────────────────────────────

interface BBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

function parseBounds(s: string | undefined): BBox | null {
  if (!s) return null;
  const parts = s.split(',').map((v) => Number.parseFloat(v));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  return { minLat: parts[0]!, minLng: parts[1]!, maxLat: parts[2]!, maxLng: parts[3]!};
}

function bboxFromZones(zones: readonly ZoneConfig[]): BBox {
  let minLat = 90,
    maxLat = -90,
    minLng = 180,
    maxLng = -180;
  for (const z of zones) {
    for (const [lat, lng] of z.polygon) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }
  return { minLat, minLng, maxLat, maxLng };
}

function bboxCenter(b: BBox): { latitude: number; longitude: number } {
  return { latitude: (b.minLat + b.maxLat) / 2, longitude: (b.minLng + b.maxLng) / 2 };
}

function bboxRadiusKm(b: BBox): number {
  const latDiff = b.maxLat - b.minLat;
  const lngDiff = b.maxLng - b.minLng;
  // Cheap small-angle haversine — within 10% of the great-circle for our box sizes.
  const km = Math.hypot(latDiff * 111, lngDiff * 111 * Math.cos(((b.minLat + b.maxLat) / 2 * Math.PI) / 180));
  return Math.max(1, km / 2);
}

function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function classifyDemand(activeOrders: number, defaultLevel: ZoneConfig['defaultDemandLevel']): OperatingZoneDto['demandLevel'] {
  if (activeOrders >= 50) return 'very_high';
  if (activeOrders >= 25) return 'high';
  if (activeOrders >= 10) return 'medium';
  if (activeOrders > 0) return 'low';
  return defaultLevel; // empty period — fall back to seed
}

// ─── Public API ─────────────────────────────────────────────────

export const locationService = {
  async reverseGeocode(query: { lat: number; lng: number }): Promise<GeocodeDto> {
    const key = RedisKeys.cacheGeocode(query.lat.toFixed(4), query.lng.toFixed(4));
    return cacheAside(key, GEOCODE_CACHE_TTL, async () => {
      // Until a real provider is wired (Google Maps / OSM), derive the
      // structured response from the pin-prefix table.  This is intentionally
      // coarse — the rider app's KYC `LocationPicker` still uses
      // `expo-location.reverseGeocodeAsync` for free-form addresses.
      const pincode = pinFromCoords(query.lat, query.lng);
      const state = PIN_PREFIX_TO_STATE[pincode.slice(0, 2)] ?? 'Karnataka';
      const formatted = `${query.lat.toFixed(4)}, ${query.lng.toFixed(4)} — ${state}, India ${pincode}`;
      return {
        formattedAddress: formatted,
        city: state,
        state,
        pincode,
      };
    });
  },

  async listOperatingZones(query: { city: string }): Promise<OperatingZoneDto[]> {
    const cacheKey = RedisKeys.cacheZones(query.city);
    return cacheAside(cacheKey, ZONES_CACHE_TTL, async () => {
      const cityZones = OPERATING_ZONES.filter((z) => z.city === query.city);
      // For each zone compute the active-rider count by scanning the GeoSet.
      const results: OperatingZoneDto[] = [];
      for (const z of cityZones) {
        const radiusKm = bboxRadiusKm(bboxFromZones([z]));
        let activeRiders = 0;
        try {
          const positions = (await redis.geosearch(
            RedisKeys.riderLocations(),
            'FROMLONLAT',
            z.centerCoords.longitude,
            z.centerCoords.latitude,
            'BYRADIUS',
            radiusKm,
            'km',
            'COUNT',
            500,
            'ASC',
          )) as string[];
          // Tighter polygon check (the radius covers the bounding circle).
          const detail = (await Promise.all(
            positions.map((id) => redis.geopos(RedisKeys.riderLocations(), id)),
          )) as ([string, string] | null)[][];
          activeRiders = detail.reduce((acc, posArr) => {
            const pos = posArr?.[0];
            if (!pos) return acc;
            const lng = Number.parseFloat(pos[0]);
            const lat = Number.parseFloat(pos[1]);
            return pointInPolygon([lat, lng], z.polygon) ? acc + 1 : acc;
          }, 0);
        } catch (e) {
          logger.warn('zones: geosearch failed', { zone: z.id, err: (e as Error).message });
        }
        // For now `activeOrders` is unmodelled — the dispatcher slice will
        // populate `cravix:zone:active-orders:{id}`. We use the rider density
        // as a proxy.
        const activeOrders = Math.round(activeRiders * 0.6);
        results.push({
          id: z.id,
          name: z.name,
          city: z.city,
          demandLevel: classifyDemand(activeOrders, z.defaultDemandLevel),
          activeRiders,
          activeOrders,
          polygon: z.polygon,
          centerCoords: z.centerCoords,
        });
      }
      return results;
    });
  },

  async getHeatmap(query: { city: string; bounds?: string }): Promise<HeatmapPointDto[]> {
    const key = prefixKey(`cache:heatmap:${query.city}:${query.bounds ?? 'auto'}`);
    return cacheAside(key, HEATMAP_CACHE_TTL, async () => {
      // Pick the bbox: explicit query OR derived from the city's zones.
      const cityZones = OPERATING_ZONES.filter((z) => z.city === query.city);
      const bbox = parseBounds(query.bounds) ?? bboxFromZones(cityZones);
      const center = bboxCenter(bbox);
      const radius = bboxRadiusKm(bbox);

      let positions: { id: string; lat: number; lng: number }[] = [];
      try {
        const ids = (await redis.geosearch(
          RedisKeys.riderLocations(),
          'FROMLONLAT',
          center.longitude,
          center.latitude,
          'BYRADIUS',
          radius,
          'km',
          'COUNT',
          1000,
          'ASC',
        )) as string[];
        const posArr = (await Promise.all(
          ids.map((id) => redis.geopos(RedisKeys.riderLocations(), id)),
        )) as ([string, string] | null)[][];
        positions = ids
          .map((id, i) => {
            const p = posArr[i]?.[0];
            return p
              ? { id, lat: Number.parseFloat(p[1]), lng: Number.parseFloat(p[0]) }
              : null;
          })
          .filter((v): v is { id: string; lat: number; lng: number } => v !== null);
      } catch (e) {
        logger.warn('heatmap: geosearch failed', { err: (e as Error).message });
      }

      // Bucket positions into a coarse grid so the FE renders smooth circles.
      const GRID = 16;
      const stepLat = (bbox.maxLat - bbox.minLat) / GRID;
      const stepLng = (bbox.maxLng - bbox.minLng) / GRID;
      const buckets = new Map<string, { latitude: number; longitude: number; count: number }>();
      for (const p of positions) {
        const gx = Math.floor((p.lng - bbox.minLng) / stepLng);
        const gy = Math.floor((p.lat - bbox.minLat) / stepLat);
        const k = `${gy}:${gx}`;
        const cell = buckets.get(k) ?? {
          latitude: bbox.minLat + (gy + 0.5) * stepLat,
          longitude: bbox.minLng + (gx + 0.5) * stepLng,
          count: 0,
        };
        cell.count += 1;
        buckets.set(k, cell);
      }

      // If the GeoSet was empty, surface the zone centroids with their seed
      // demand so the FE never renders a blank heatmap during dev/onboarding.
      if (buckets.size === 0) {
        return cityZones.map((z) => ({
          latitude: z.centerCoords.latitude,
          longitude: z.centerCoords.longitude,
          weight:
            z.defaultDemandLevel === 'very_high'
              ? 0.95
              : z.defaultDemandLevel === 'high'
              ? 0.75
              : z.defaultDemandLevel === 'medium'
              ? 0.5
              : 0.3,
        }));
      }

      const max = Math.max(1, ...Array.from(buckets.values()).map((b) => b.count));
      return Array.from(buckets.values()).map((b) => ({
        latitude: b.latitude,
        longitude: b.longitude,
        weight: Number((b.count / max).toFixed(3)),
      }));
    });
  },
};
