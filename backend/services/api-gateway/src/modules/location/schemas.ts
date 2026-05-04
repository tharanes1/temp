/**
 * Zod schemas for /api/v1/location/*.
 */
import { z } from 'zod';

export const GeocodeQuerySchema = z
  .object({
    lat: z.coerce.number().gte(-90).lte(90),
    lng: z.coerce.number().gte(-180).lte(180),
  })
  .strict();
export type GeocodeQuery = z.infer<typeof GeocodeQuerySchema>;

export const ZonesQuerySchema = z
  .object({
    city: z.string().trim().min(2).max(80).default('bengaluru'),
  })
  .strict();
export type ZonesQuery = z.infer<typeof ZonesQuerySchema>;

/**
 * `bounds` is a CSV "minLat,minLng,maxLat,maxLng" — tight format for query
 * strings, but the parser splits and Zod-checks each component individually.
 */
export const HeatmapQuerySchema = z
  .object({
    city: z.string().trim().min(2).max(80).default('bengaluru'),
    bounds: z.string().min(1).optional(),
  })
  .strict();
export type HeatmapQuery = z.infer<typeof HeatmapQuerySchema>;
