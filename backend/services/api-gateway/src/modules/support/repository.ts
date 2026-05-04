/**
 * Persistence for the Support module.
 */
import { Prisma, type FaqEntry, type SupportTicket } from '@prisma/client';

import { prisma } from '../../config/database.js';

export const supportRepository = {
  async listFaqs(category?: string): Promise<FaqEntry[]> {
    const where: Prisma.FaqEntryWhereInput = { isActive: true };
    if (category) where.category = category;
    return prisma.faqEntry.findMany({
      where,
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });
  },

  async createTicket(args: {
    riderId: string;
    category: string;
    subject: string;
    description: string;
    orderId?: string;
  }): Promise<SupportTicket> {
    return prisma.supportTicket.create({
      data: {
        riderId: args.riderId,
        category: args.category,
        subject: args.subject,
        description: args.description,
        orderId: args.orderId ?? null,
      },
    });
  },

  /**
   * Compose digital documents from Rider + KycApplication + Vehicle.  The
   * spec returns a flattened list — we project once here so the service
   * layer stays thin.
   */
  async getDocuments(riderId: string): Promise<{
    rider: { id: string; createdAt: Date; kycStatus: string } | null;
    kyc: { aadhaarFront: string | null; panCard: string | null; drivingLicense: string | null; submittedAt: Date | null; reviewedAt: Date | null } | null;
    vehicle: { rcImage: string | null; insurancePolicy: string | null; insuranceExpiry: Date | null } | null;
  }> {
    const [rider, kyc, vehicle] = await Promise.all([
      prisma.rider.findUnique({
        where: { id: riderId },
        select: { id: true, createdAt: true, kycStatus: true },
      }),
      prisma.kycApplication.findUnique({
        where: { riderId },
        select: {
          aadhaarFront: true,
          panCard: true,
          drivingLicense: true,
          submittedAt: true,
          reviewedAt: true,
        },
      }),
      prisma.vehicle.findUnique({
        where: { riderId },
        select: { rcImage: true, insurancePolicy: true, insuranceExpiry: true },
      }),
    ]);
    return { rider, kyc, vehicle };
  },
};
