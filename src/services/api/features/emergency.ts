/**
 * Emergency service — wraps /api/v1/emergency/*.
 */
import apiClient from '../client';

export const EMERGENCY_ENDPOINTS = {
  CONTACTS: '/api/v1/emergency/contacts',
  CONTACT: (id: string) => `/api/v1/emergency/contacts/${id}`,
  MEDICAL: '/api/v1/emergency/medical',
  SOS: '/api/v1/emergency/sos',
} as const;

export type Relationship = 'spouse' | 'parent' | 'sibling' | 'friend' | 'other';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: Relationship;
  isPrimary: boolean;
  createdAt: string;
}

export interface MedicalInfo {
  bloodGroup: string | null;
  allergies: string[];
  medicalConditions: string[];
  medications: string | null;
  insurancePolicyNumber: string | null;
  updatedAt: string | null;
}

export interface SosResponse {
  sosEventId: string;
  acknowledgedAt: string;
  estimatedResponseSeconds: number;
}

interface Envelope<T> {
  success: true;
  data: T;
}

export const emergencyService = {
  async listContacts(): Promise<EmergencyContact[]> {
    const { data } = await apiClient.get<Envelope<EmergencyContact[]>>(EMERGENCY_ENDPOINTS.CONTACTS);
    return data.data;
  },
  async createContact(body: {
    name: string;
    phone: string;
    relationship: Relationship;
    isPrimary?: boolean;
  }): Promise<EmergencyContact> {
    const { data } = await apiClient.post<Envelope<EmergencyContact>>(EMERGENCY_ENDPOINTS.CONTACTS, body);
    return data.data;
  },
  async updateContact(
    id: string,
    body: Partial<{ name: string; phone: string; relationship: Relationship; isPrimary: boolean }>,
  ): Promise<EmergencyContact> {
    const { data } = await apiClient.put<Envelope<EmergencyContact>>(EMERGENCY_ENDPOINTS.CONTACT(id), body);
    return data.data;
  },
  async deleteContact(id: string): Promise<{ count: number }> {
    const { data } = await apiClient.delete<Envelope<{ count: number }>>(EMERGENCY_ENDPOINTS.CONTACT(id));
    return data.data;
  },
  async getMedical(): Promise<MedicalInfo> {
    const { data } = await apiClient.get<Envelope<MedicalInfo>>(EMERGENCY_ENDPOINTS.MEDICAL);
    return data.data;
  },
  async updateMedical(body: Partial<{
    bloodGroup: string | null;
    allergies: string[];
    medicalConditions: string[];
    medications: string | null;
    insurancePolicyNumber: string | null;
  }>): Promise<MedicalInfo> {
    const { data } = await apiClient.put<Envelope<MedicalInfo>>(EMERGENCY_ENDPOINTS.MEDICAL, body);
    return data.data;
  },
  async triggerSos(args: {
    latitude: number;
    longitude: number;
    type: 'accident' | 'medical' | 'safety' | 'other';
    note?: string;
  }): Promise<SosResponse> {
    const { data } = await apiClient.post<Envelope<SosResponse>>(EMERGENCY_ENDPOINTS.SOS, args);
    return data.data;
  },
};
