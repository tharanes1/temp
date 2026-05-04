/**
 * Shifts persistence — single row per rider in `ShiftPreference`.
 */
import type { ShiftPreference } from '@prisma/client';

import { prisma } from '../../config/database.js';

export const shiftsRepository = {
  async upsertPreferences(args: {
    riderId: string;
    morningEnabled: boolean;
    afternoonEnabled: boolean;
    nightEnabled: boolean;
    windowStart: string;
    windowEnd: string;
  }): Promise<ShiftPreference> {
    return prisma.shiftPreference.upsert({
      where: { riderId: args.riderId },
      create: {
        riderId: args.riderId,
        morningEnabled: args.morningEnabled,
        afternoonEnabled: args.afternoonEnabled,
        nightEnabled: args.nightEnabled,
        windowStart: args.windowStart,
        windowEnd: args.windowEnd,
      },
      update: {
        morningEnabled: args.morningEnabled,
        afternoonEnabled: args.afternoonEnabled,
        nightEnabled: args.nightEnabled,
        windowStart: args.windowStart,
        windowEnd: args.windowEnd,
      },
    });
  },

  async findByRiderId(riderId: string): Promise<ShiftPreference | null> {
    return prisma.shiftPreference.findUnique({ where: { riderId } });
  },
};
