/**
 * Persistence layer for Auth. Owns Rider create/upsert and AuthEvent inserts.
 * No business logic here — only Prisma calls.
 */
import { Prisma, type Rider } from '@prisma/client';

import { prisma } from '../../config/database.js';
import { newId } from '../../shared/utils/uuid.js';

export const authRepository = {
  async findRiderByPhone(phone: string): Promise<Rider | null> {
    return prisma.rider.findUnique({ where: { phone } });
  },

  async upsertRider(phone: string): Promise<Rider> {
    return prisma.rider.upsert({
      where: { phone },
      create: {
        id: newId(),
        phone,
      },
      update: {},
    });
  },

  async setConsent(riderId: string, version: string): Promise<void> {
    await prisma.rider.update({
      where: { id: riderId },
      data: {
        consentVersion: version,
        consentGivenAt: new Date(),
      },
    });
  },

  async logAuthEvent(args: {
    riderId?: string | null;
    type: string;
    ip?: string | null;
    userAgent?: string | null;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await prisma.authEvent.create({
      data: {
        riderId: args.riderId ?? null,
        type: args.type,
        ip: args.ip ?? null,
        userAgent: args.userAgent ?? null,
        metadata: args.metadata ?? Prisma.JsonNull,
      },
    });
  },

  /** Used by KYC isComplete check (cheap heuristic — verified KYC). */
  async isKycVerified(riderId: string): Promise<boolean> {
    const r = await prisma.rider.findUnique({ where: { id: riderId }, select: { kycStatus: true } });
    return r?.kycStatus === 'VERIFIED';
  },
};
