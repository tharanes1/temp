/**
 * Shifts service.
 *
 *   • GET /preferences   — server is source of truth (spec §15).
 *   • PUT /preferences   — upsert.
 *   • GET /schedule      — projection over the next 7 days based on prefs +
 *                          a deterministic per-day-of-week demand table.
 *   • GET /active        — derives "is currently inside one of the shift
 *                          windows" from the wall-clock + prefs.
 *
 * Demand-forecast values are pinned per day-of-week today; the dispatcher
 * slice replaces this with computed surge data once historical aggregates are
 * available.
 */
import type { ShiftPreference } from '@prisma/client';

import { shiftsRepository } from './repository.js';
import type { ShiftPreferencesInput } from './schemas.js';
import type {
  ActiveShiftDto,
  ShiftPreferencesDto,
  ShiftScheduleDto,
  UpcomingShiftDto,
} from './types.js';

// ─── Demand seed (deterministic) ─────────────────────────────────

type DayName = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
type ShiftSlot = 'morning' | 'afternoon' | 'night';
type Demand = 'low' | 'medium' | 'high' | 'very_high';

const WEEKLY_FORECAST: Record<DayName, Demand> = {
  Monday: 'high',
  Tuesday: 'medium',
  Wednesday: 'high',
  Thursday: 'low',
  Friday: 'high',
  Saturday: 'very_high',
  Sunday: 'very_high',
};

const SHIFT_RANGES: Record<ShiftSlot, { startHour: number; endHour: number }> = {
  morning: { startHour: 6, endHour: 12 },
  afternoon: { startHour: 12, endHour: 17 },
  night: { startHour: 17, endHour: 23 },
};

const ESTIMATE_BY_DEMAND: Record<Demand, { min: number; max: number }> = {
  low: { min: 80, max: 140 },
  medium: { min: 140, max: 200 },
  high: { min: 200, max: 320 },
  very_high: { min: 320, max: 500 },
};

const DAY_NAMES: DayName[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const ordered: DayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
void ordered;

// ─── Helpers ─────────────────────────────────────────────────────

function projectPreferences(p: ShiftPreference): ShiftPreferencesDto {
  return {
    presets: {
      morning: p.morningEnabled,
      afternoon: p.afternoonEnabled,
      night: p.nightEnabled,
    },
    customWindow: { start: p.windowStart, end: p.windowEnd },
    updatedAt: p.updatedAt.toISOString(),
  };
}

function dayName(date: Date): DayName {
  return DAY_NAMES[date.getDay()]!;
}

function isInsideRange(now: Date, range: { startHour: number; endHour: number }): boolean {
  const h = now.getHours();
  return h >= range.startHour && h < range.endHour;
}

// ─── Public API ─────────────────────────────────────────────────

export const shiftsService = {
  async getPreferences(riderId: string): Promise<ShiftPreferencesDto> {
    const existing = await shiftsRepository.findByRiderId(riderId);
    if (existing) return projectPreferences(existing);
    // Seed defaults so the FE doesn't 404 on first read.
    const seeded = await shiftsRepository.upsertPreferences({
      riderId,
      morningEnabled: false,
      afternoonEnabled: false,
      nightEnabled: false,
      windowStart: '08:00',
      windowEnd: '17:00',
    });
    return projectPreferences(seeded);
  },

  async setPreferences(riderId: string, input: ShiftPreferencesInput): Promise<ShiftPreferencesDto> {
    const updated = await shiftsRepository.upsertPreferences({
      riderId,
      morningEnabled: input.presets.morning,
      afternoonEnabled: input.presets.afternoon,
      nightEnabled: input.presets.night,
      windowStart: input.customWindow.start,
      windowEnd: input.customWindow.end,
    });
    return projectPreferences(updated);
  },

  /**
   * Schedule projection for the next 7 days.  For each day, we surface every
   * preset the rider has enabled, sized by the per-day-of-week demand seed.
   * If a rider hasn't enabled any preset, the response just carries
   * `weeklyForecast` so the screen can still render the heatmap.
   */
  async getSchedule(riderId: string): Promise<ShiftScheduleDto> {
    const prefs = await shiftsRepository.findByRiderId(riderId);
    const presets: ShiftSlot[] = [];
    if (prefs?.morningEnabled) presets.push('morning');
    if (prefs?.afternoonEnabled) presets.push('afternoon');
    if (prefs?.nightEnabled) presets.push('night');

    const upcoming: UpcomingShiftDto[] = [];
    if (presets.length > 0) {
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + i);
        const demand = WEEKLY_FORECAST[dayName(d)];
        for (const slot of presets) {
          upcoming.push({
            date: d.toISOString().slice(0, 10),
            shift: slot,
            demandLevel: demand,
            estimatedEarnings: ESTIMATE_BY_DEMAND[demand],
          });
        }
      }
    }

    return {
      upcoming,
      weeklyForecast: WEEKLY_FORECAST,
    };
  },

  /**
   * Currently-active shift = rider has a preset that includes the wall-clock
   * hour right now AND `Rider.isActive` (we use the prefs row's morning/afternoon/night
   * flags + the time of day). Independent from `cravix:rider:status` which
   * tracks duty toggle.
   */
  async getActive(riderId: string): Promise<ActiveShiftDto> {
    const prefs = await shiftsRepository.findByRiderId(riderId);
    if (!prefs) return { isActive: false, shift: null, startedAt: null, endsAt: null };

    const now = new Date();
    let active: ShiftSlot | null = null;
    if (prefs.morningEnabled && isInsideRange(now, SHIFT_RANGES.morning)) active = 'morning';
    else if (prefs.afternoonEnabled && isInsideRange(now, SHIFT_RANGES.afternoon)) active = 'afternoon';
    else if (prefs.nightEnabled && isInsideRange(now, SHIFT_RANGES.night)) active = 'night';

    if (!active) return { isActive: false, shift: null, startedAt: null, endsAt: null };

    const range = SHIFT_RANGES[active];
    const start = new Date(now);
    start.setHours(range.startHour, 0, 0, 0);
    const end = new Date(now);
    end.setHours(range.endHour, 0, 0, 0);

    return {
      isActive: true,
      shift: active,
      startedAt: start.toISOString(),
      endsAt: end.toISOString(),
    };
  },
};
