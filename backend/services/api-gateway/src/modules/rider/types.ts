/**
 * Wire-format DTOs for the Rider module. Matches the response envelopes
 * documented in spec §5.2 with the locked-A5 vehicle/bike split.
 */

export interface RiderProfileDto {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  profileImage: string | null;
  gender: 'male' | 'female' | 'other' | null;
  dateOfBirth: string | null; // YYYY-MM-DD
  isOnline: boolean;
  rating: number;
  totalDeliveries: number;

  /** Locked A5 — see VehicleDto for the canonical vehicle shape; this mirror
   *  in the profile lets old screens (HomeHeader) read in one round-trip. */
  vehicleType: 'petrol' | 'ev' | null;
  bikeType: 'bike' | 'bicycle' | 'scooter' | 'ev' | null;

  kycStatus: 'not_started' | 'in_progress' | 'under_review' | 'verified' | 'rejected' | 'disabled';
  joiningDate: string; // ISO timestamp
}

export interface RiderStatusDto {
  isOnline: boolean;
  since: string | null; // ISO timestamp; null when never set
  lastSeen: string | null;
}

export interface VehicleDto {
  vehicleType: 'petrol' | 'ev' | null;
  bikeType: 'bike' | 'bicycle' | 'scooter' | 'ev' | null;
  make: string | null;
  model: string | null;
  year: number | null;
  registrationNumber: string | null;
  rcImage: string | null;
  bikePhoto: string | null;
  insuranceNumber: string | null;
  insurancePolicy: string | null;
  insuranceExpiry: string | null; // YYYY-MM-DD
}
