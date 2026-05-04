/**
 * Wire-format DTOs for /shifts.  Money is `number` rupees (locked A6).
 */

export interface ShiftPreferencesDto {
  presets: { morning: boolean; afternoon: boolean; night: boolean };
  customWindow: { start: string; end: string };
  updatedAt: string;
}

export interface UpcomingShiftDto {
  date: string; // YYYY-MM-DD
  shift: 'morning' | 'afternoon' | 'night';
  demandLevel: 'low' | 'medium' | 'high' | 'very_high';
  estimatedEarnings: { min: number; max: number };
}

export interface ShiftScheduleDto {
  upcoming: UpcomingShiftDto[];
  weeklyForecast: Record<
    'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday',
    'low' | 'medium' | 'high' | 'very_high'
  >;
}

export interface ActiveShiftDto {
  isActive: boolean;
  shift: 'morning' | 'afternoon' | 'night' | null;
  startedAt: string | null;
  endsAt: string | null;
}
