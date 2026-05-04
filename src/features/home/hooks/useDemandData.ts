/**
 * Demand-heatmap hook.
 *
 * Replaces the previous `Math.random()` mock generator (review §6.3 #16).
 * Pulls from `/api/v1/location/heatmap` (Redis-cached 60s server-side, plus
 * a 30s client poll matching the previous refresh cadence).
 *
 * Uses the rider's current location to derive a tight bounding box (~2km on a
 * side) so the heatmap concentrates on what's nearby; falls back to the city's
 * full set of zones if location is unavailable.
 */
import { useEffect, useState } from 'react';

import { useLocation } from '@/features/map/hooks/useLocation';
import { locationService } from '@/services/api/features/location';

export interface DemandPoint {
  id: string;
  latitude: number;
  longitude: number;
  weight: number; // 0 → 1 intensity
}

const REFRESH_MS = 30_000;
const BOX_HALF_DEG = 0.01; // ~1.1 km — gives a ~2.2 km square

export const useDemandData = () => {
  const { location } = useLocation();
  const [demandPoints, setDemandPoints] = useState<DemandPoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const bounds = location
          ? `${location.latitude - BOX_HALF_DEG},${location.longitude - BOX_HALF_DEG},${location.latitude + BOX_HALF_DEG},${location.longitude + BOX_HALF_DEG}`
          : undefined;
        const points = await locationService.getHeatmap(
          bounds ? { city: 'bengaluru', bounds } : { city: 'bengaluru' },
        );
        if (cancelled) return;
        setDemandPoints(
          points.map((p, i) => ({
            id: `demand-${i}`,
            latitude: p.latitude,
            longitude: p.longitude,
            weight: p.weight,
          })),
        );
      } catch (e) {
        if (__DEV__) console.warn('[heatmap] fetch failed', (e as Error).message);
      }
    };

    void load();
    const interval = setInterval(() => {
      void load();
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [location?.latitude, location?.longitude]);

  return { demandPoints };
};
