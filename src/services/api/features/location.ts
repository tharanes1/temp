/**
 * Location service — wraps /api/v1/location/*.
 */
import apiClient from '../client';

export const LOCATION_ENDPOINTS = {
  GEOCODE: '/api/v1/location/geocode',
  ZONES: '/api/v1/location/operating-zones',
  HEATMAP: '/api/v1/location/heatmap',
} as const;

export interface Geocode {
  formattedAddress: string;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export interface OperatingZone {
  id: string;
  name: string;
  city: string;
  demandLevel: 'low' | 'medium' | 'high' | 'very_high';
  activeRiders: number;
  activeOrders: number;
  polygon: [number, number][];
  centerCoords: { latitude: number; longitude: number };
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number;
}

interface Envelope<T> {
  success: true;
  data: T;
}

export const locationService = {
  async reverseGeocode(lat: number, lng: number): Promise<Geocode> {
    const { data } = await apiClient.get<Envelope<Geocode>>(LOCATION_ENDPOINTS.GEOCODE, {
      params: { lat, lng },
    });
    return data.data;
  },
  async listOperatingZones(city = 'bengaluru'): Promise<OperatingZone[]> {
    const { data } = await apiClient.get<Envelope<OperatingZone[]>>(LOCATION_ENDPOINTS.ZONES, {
      params: { city },
    });
    return data.data;
  },
  async getHeatmap(args: { city?: string; bounds?: string } = {}): Promise<HeatmapPoint[]> {
    const params: Record<string, string> = { city: args.city ?? 'bengaluru' };
    if (args.bounds) params.bounds = args.bounds;
    const { data } = await apiClient.get<Envelope<HeatmapPoint[]>>(LOCATION_ENDPOINTS.HEATMAP, {
      params,
    });
    return data.data;
  },
};
