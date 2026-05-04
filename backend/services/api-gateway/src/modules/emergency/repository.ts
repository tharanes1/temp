/**
 * Persistence for emergency contacts, medical info, and SOS events.
 */
import { Prisma, type EmergencyContact, type MedicalInfo, type SosEvent } from '@prisma/client';

import { prisma } from '../../config/database.js';
import { newId } from '../../shared/utils/uuid.js';

export const emergencyRepository = {
  // ─── Contacts ────────────────────────────────────────────────

  async listContacts(riderId: string): Promise<EmergencyContact[]> {
    return prisma.emergencyContact.findMany({
      where: { riderId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  },

  async createContact(args: {
    riderId: string;
    name: string;
    phone: string;
    relationship: string;
    isPrimary: boolean;
  }): Promise<EmergencyContact> {
    return prisma.$transaction(async (tx) => {
      if (args.isPrimary) {
        await tx.emergencyContact.updateMany({
          where: { riderId: args.riderId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      return tx.emergencyContact.create({
        data: {
          riderId: args.riderId,
          name: args.name,
          phone: args.phone,
          relationship: args.relationship,
          isPrimary: args.isPrimary,
        },
      });
    });
  },

  async findContact(args: { riderId: string; contactId: string }): Promise<EmergencyContact | null> {
    return prisma.emergencyContact.findFirst({
      where: { id: args.contactId, riderId: args.riderId },
    });
  },

  async updateContact(args: {
    riderId: string;
    contactId: string;
    patch: Partial<{ name: string; phone: string; relationship: string; isPrimary: boolean }>;
  }): Promise<EmergencyContact> {
    return prisma.$transaction(async (tx) => {
      if (args.patch.isPrimary === true) {
        await tx.emergencyContact.updateMany({
          where: { riderId: args.riderId, isPrimary: true, NOT: { id: args.contactId } },
          data: { isPrimary: false },
        });
      }
      return tx.emergencyContact.update({
        where: { id: args.contactId },
        data: args.patch as Prisma.EmergencyContactUpdateInput,
      });
    });
  },

  async deleteContact(args: { riderId: string; contactId: string }): Promise<{ count: number }> {
    const r = await prisma.emergencyContact.deleteMany({
      where: { id: args.contactId, riderId: args.riderId },
    });
    return { count: r.count };
  },

  // ─── Medical ─────────────────────────────────────────────────

  async getMedical(riderId: string): Promise<MedicalInfo | null> {
    return prisma.medicalInfo.findUnique({ where: { riderId } });
  },

  async upsertMedical(args: {
    riderId: string;
    patch: Partial<{
      bloodGroup: string | null;
      allergies: string[];
      medicalConditions: string[];
      medications: string | null;
      insurancePolicyNumber: string | null;
    }>;
  }): Promise<MedicalInfo> {
    const create: Prisma.MedicalInfoCreateInput = {
      rider: { connect: { id: args.riderId } },
      bloodGroup: args.patch.bloodGroup ?? null,
      allergies: args.patch.allergies ?? [],
      medicalConditions: args.patch.medicalConditions ?? [],
      medications: args.patch.medications ?? null,
      insurancePolicyNumber: args.patch.insurancePolicyNumber ?? null,
    };
    const update: Prisma.MedicalInfoUpdateInput = {};
    if (args.patch.bloodGroup !== undefined) update.bloodGroup = args.patch.bloodGroup;
    if (args.patch.allergies !== undefined) update.allergies = { set: args.patch.allergies };
    if (args.patch.medicalConditions !== undefined) update.medicalConditions = { set: args.patch.medicalConditions };
    if (args.patch.medications !== undefined) update.medications = args.patch.medications;
    if (args.patch.insurancePolicyNumber !== undefined) update.insurancePolicyNumber = args.patch.insurancePolicyNumber;

    return prisma.medicalInfo.upsert({
      where: { riderId: args.riderId },
      create,
      update,
    });
  },

  // ─── SOS ─────────────────────────────────────────────────────

  async createSosEvent(args: {
    riderId: string;
    type: string;
    latitude: number;
    longitude: number;
    note?: string;
  }): Promise<SosEvent> {
    return prisma.sosEvent.create({
      data: {
        id: newId(),
        riderId: args.riderId,
        type: args.type,
        latitude: new Prisma.Decimal(args.latitude),
        longitude: new Prisma.Decimal(args.longitude),
        ...(args.note !== undefined ? { metadata: { note: args.note } } : {}),
      },
    });
  },
};
