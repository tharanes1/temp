/**
 * Shifts service — wraps /api/v1/shifts/*.
 *
 * Locked decision (alignment review §15): server is the source of truth.
 * AsyncStorage is now an offline cache only.
 */
import apiClient from '../client';

export const SHIFTS_ENDPOINTS = {
  PREFERENCES: '/api/v1/shifts/preferences',
  SCHEDULE: '/api/v1/shifts/schedule',
  ACTIVE: '/api/v1/shifts/active',
} as const;

export interface ShiftPreferences {
  presets: { morning: boolean; afternoon: boolean; night: boolean };
  customWindow: { start: string; end: string };
  updatedAt: string;
}

export type DemandLevel = 'low' | 'medium' | 'high' | 'very_high';

export interface UpcomingShift {
  date: string;
  shift: 'morning' | 'afternoon' | 'night';
  demandLevel: DemandLevel;
  estimatedEarnings: { min: number; max: number };
}

export interface ShiftSchedule {
  upcoming: UpcomingShift[];
  weeklyForecast: Record<
    'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday',
    DemandLevel
  >;
}

export interface ActiveShift {
  isActive: boolean;
  shift: 'morning' | 'afternoon' | 'night' | null;
  startedAt: string | null;
  endsAt: string | null;
}

interface Envelope<T> {
  success: true;
  data: T;
}

export const shiftsService = {
  async getPreferences(): Promise<ShiftPreferences> {
    const { data } = await apiClient.get<Envelope<ShiftPreferences>>(SHIFTS_ENDPOINTS.PREFERENCES);
    return data.data;
  },
  async setPreferences(body: Pick<ShiftPreferences, 'presets' | 'customWindow'>): Promise<ShiftPreferences> {
    const { data } = await apiClient.put<Envelope<ShiftPreferences>>(SHIFTS_ENDPOINTS.PREFERENCES, body);
    return data.data;
  },
  async getSchedule(): Promise<ShiftSchedule> {
    const { data } = await apiClient.get<Envelope<ShiftSchedule>>(SHIFTS_ENDPOINTS.SCHEDULE);
    return data.data;
  },
  async getActive(): Promise<ActiveShift> {
    const { data } = await apiClient.get<Envelope<ActiveShift>>(SHIFTS_ENDPOINTS.ACTIVE);
    return data.data;
  },
};
