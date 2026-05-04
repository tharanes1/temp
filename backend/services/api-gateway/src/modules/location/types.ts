/**
 * Wire-format DTOs for /location.
 */

export interface GeocodeDto {
  formattedAddress: string;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export interface OperatingZoneDto {
  id: string;
  name: string;
  city: string;
  demandLevel: 'low' | 'medium' | 'high' | 'very_high';
  activeRiders: number;
  activeOrders: number;
  polygon: [number, number][];
  centerCoords: { latitude: number; longitude: number };
}

export interface HeatmapPointDto {
  latitude: number;
  longitude: number;
  weight: number;
}
