/**
 * Wire-format DTOs for /emergency.
 */

export interface EmergencyContactDto {
  id: string;
  name: string;
  phone: string;
  relationship: 'spouse' | 'parent' | 'sibling' | 'friend' | 'other';
  isPrimary: boolean;
  createdAt: string;
}

export interface MedicalInfoDto {
  bloodGroup: string | null;
  allergies: string[];
  medicalConditions: string[];
  medications: string | null;
  insurancePolicyNumber: string | null;
  updatedAt: string | null;
}

export interface SosResponseDto {
  sosEventId: string;
  acknowledgedAt: string;
  /** ETA for ops to call the rider, surfaced to the FE as reassurance copy. */
  estimatedResponseSeconds: number;
}
