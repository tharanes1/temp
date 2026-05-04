/**
 * Rider service — wraps /api/v1/rider/{profile,status,vehicle}.
 *
 * Locked decisions reflected in the DTOs:
 *   A5 — vehicle has BOTH `vehicleType` (petrol|ev|null) AND `bikeType`
 *        (bike|bicycle|scooter|ev). Bicycles must have vehicleType=null.
 *   A6 — money is decimal rupees (no fields here, but rating is a number).
 */
import apiClient from '../client';

export const RIDER_ENDPOINTS = {
  PROFILE: '/api/v1/rider/profile',
  STATUS: '/api/v1/rider/status',
  VEHICLE: '/api/v1/rider/vehicle',
} as const;

// ─── DTOs ────────────────────────────────────────────────────────

export type Gender = 'male' | 'female' | 'other';
export type VehicleType = 'petrol' | 'ev';
export type BikeType = 'bike' | 'bicycle' | 'scooter' | 'ev';
export type KycStatus =
  | 'not_started'
  | 'in_progress'
  | 'under_review'
  | 'verified'
  | 'rejected'
  | 'disabled';

export interface RiderProfile {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  profileImage: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  isOnline: boolean;
  rating: number;
  totalDeliveries: number;
  vehicleType: VehicleType | null;
  bikeType: BikeType | null;
  kycStatus: KycStatus;
  joiningDate: string;
}

export interface RiderStatus {
  isOnline: boolean;
  since: string | null;
  lastSeen: string | null;
}

export interface VehicleInfo {
  vehicleType: VehicleType | null;
  bikeType: BikeType | null;
  make: string | null;
  model: string | null;
  year: number | null;
  registrationNumber: string | null;
  rcImage: string | null;
  bikePhoto: string | null;
  insuranceNumber: string | null;
  insurancePolicy: string | null;
  insuranceExpiry: string | null;
}

export interface UpdateProfileBody {
  name?: string;
  email?: string;
  profileImage?: string;
  gender?: Gender;
  dateOfBirth?: string; // YYYY-MM-DD
}

export interface UpdateVehicleBody {
  vehicleType?: VehicleType | null;
  bikeType?: BikeType;
  make?: string;
  model?: string;
  year?: number;
  registrationNumber?: string;
  rcImage?: string;
  bikePhoto?: string;
  insuranceNumber?: string;
  insurancePolicy?: string;
  insuranceExpiry?: string;
}

interface ApiEnvelope<T> {
  success: true;
  data: T;
}

// ─── Service ────────────────────────────────────────────────────

export const riderService = {
  async getProfile(): Promise<RiderProfile> {
    const { data } = await apiClient.get<ApiEnvelope<RiderProfile>>(RIDER_ENDPOINTS.PROFILE);
    return data.data;
  },

  async updateProfile(body: UpdateProfileBody): Promise<RiderProfile> {
    const { data } = await apiClient.patch<ApiEnvelope<RiderProfile>>(
      RIDER_ENDPOINTS.PROFILE,
      body,
    );
    return data.data;
  },

  async getStatus(): Promise<RiderStatus> {
    const { data } = await apiClient.get<ApiEnvelope<RiderStatus>>(RIDER_ENDPOINTS.STATUS);
    return data.data;
  },

  async setStatus(isOnline: boolean): Promise<RiderStatus> {
    const { data } = await apiClient.patch<ApiEnvelope<RiderStatus>>(
      RIDER_ENDPOINTS.STATUS,
      { isOnline },
    );
    return data.data;
  },

  async getVehicle(): Promise<VehicleInfo> {
    const { data } = await apiClient.get<ApiEnvelope<VehicleInfo>>(RIDER_ENDPOINTS.VEHICLE);
    return data.data;
  },

  async updateVehicle(body: UpdateVehicleBody): Promise<VehicleInfo> {
    const { data } = await apiClient.patch<ApiEnvelope<VehicleInfo>>(
      RIDER_ENDPOINTS.VEHICLE,
      body,
    );
    return data.data;
  },
};
