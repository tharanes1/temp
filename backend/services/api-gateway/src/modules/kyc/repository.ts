/**
 * Persistence for KYC.  KycApplication is upserted by riderId — every step
 * mutates the same row so progress survives page reloads.  RiderAddress is
 * upserted from the personal step.
 */
import { Prisma, type Category, type Gender, type KycApplication, type SubCategory } from '@prisma/client';

import { prisma } from '../../config/database.js';

export const kycRepository = {
  async findByRiderId(riderId: string): Promise<KycApplication | null> {
    return prisma.kycApplication.findUnique({ where: { riderId } });
  },

  async ensure(riderId: string): Promise<KycApplication> {
    return prisma.kycApplication.upsert({
      where: { riderId },
      create: { riderId },
      update: {},
    });
  },

  async setCategory(riderId: string, category: Category, subCategory: SubCategory): Promise<KycApplication> {
    return prisma.kycApplication.upsert({
      where: { riderId },
      create: { riderId, category, subCategory },
      update: { category, subCategory },
    });
  },

  async setPersonal(args: {
    riderId: string;
    fullName: string;
    email?: string;
    dateOfBirth: Date;
    gender: Gender;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      pincode: string;
      district?: string;
      latitude?: number;
      longitude?: number;
    };
  }): Promise<void> {
    const personalData: Prisma.RiderUpdateInput = {
      name: args.fullName,
      gender: args.gender,
      dateOfBirth: args.dateOfBirth,
    };
    if (args.email !== undefined) personalData.email = args.email;
    await prisma.$transaction(async (tx) => {
      await tx.rider.update({ where: { id: args.riderId }, data: personalData });
      await tx.riderAddress.upsert({
        where: { riderId: args.riderId },
        create: {
          riderId: args.riderId,
          line1: args.address.line1,
          line2: args.address.line2 ?? null,
          city: args.address.city,
          state: args.address.state,
          pincode: args.address.pincode,
          district: args.address.district ?? null,
          latitude: args.address.latitude ?? null,
          longitude: args.address.longitude ?? null,
        },
        update: {
          line1: args.address.line1,
          line2: args.address.line2 ?? null,
          city: args.address.city,
          state: args.address.state,
          pincode: args.address.pincode,
          district: args.address.district ?? null,
          latitude: args.address.latitude ?? null,
          longitude: args.address.longitude ?? null,
        },
      });
      await tx.kycApplication.upsert({
        where: { riderId: args.riderId },
        create: { riderId: args.riderId },
        update: {},
      });
    });
  },

  async setDocuments(riderId: string, documents: Partial<Pick<KycApplication, 'aadhaarFront' | 'aadhaarBack' | 'panCard' | 'drivingLicense' | 'selfie'>>): Promise<KycApplication> {
    return prisma.kycApplication.upsert({
      where: { riderId },
      create: { riderId, ...documents },
      update: documents,
    });
  },

  async setStudent(riderId: string, args: {
    collegeName: string;
    enrollmentNumber: string;
    collegeIdImage: string;
  }): Promise<KycApplication> {
    return prisma.kycApplication.upsert({
      where: { riderId },
      create: { riderId, ...args },
      update: args,
    });
  },

  async setDisabled(riderId: string, args: {
    disabilityCertNumber: string;
    disabilityDetails: string;
    disabilityProof: string;
  }): Promise<KycApplication> {
    return prisma.kycApplication.upsert({
      where: { riderId },
      create: { riderId, ...args },
      update: args,
    });
  },

  async markSubmitted(riderId: string): Promise<void> {
    await prisma.$transaction([
      prisma.kycApplication.update({
        where: { riderId },
        data: { submittedAt: new Date() },
      }),
      prisma.rider.update({
        where: { id: riderId },
        data: { kycStatus: 'UNDER_REVIEW' },
      }),
    ]);
  },
};
