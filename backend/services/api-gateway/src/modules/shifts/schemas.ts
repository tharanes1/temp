/**
 * Zod schemas for /api/v1/shifts/*.
 *
 * Locked decision A6 isn't relevant here (no money fields).  The shifts
 * module persists rider preferences server-side so they sync across
 * devices — review §15 of the alignment doc explicitly calls this out
 * as a deviation from the AsyncStorage-only original.
 */
import { z } from 'zod';

const TimeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:mm 24h

export const ShiftPreferencesSchema = z
  .object({
    presets: z
      .object({
        morning: z.boolean(),
        afternoon: z.boolean(),
        night: z.boolean(),
      })
      .strict(),
    customWindow: z
      .object({
        start: z.string().regex(TimeRegex, 'Use HH:mm'),
        end: z.string().regex(TimeRegex, 'Use HH:mm'),
      })
      .strict(),
  })
  .strict()
  .refine((v) => v.customWindow.start !== v.customWindow.end, {
    message: 'start and end must differ',
    path: ['customWindow'],
  });

export type ShiftPreferencesInput = z.infer<typeof ShiftPreferencesSchema>;
