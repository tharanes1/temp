/**
 * Emergency service.
 *
 *   • Contacts CRUD with single-primary enforcement.
 *   • Medical info upsert.
 *   • SOS:
 *       1. Insert SosEvent row (durable record).
 *       2. Publish cravix:events:emergency:sos so the socket-gateway can fan
 *          out to the admin namespace.
 *       3. Enqueue priority-1 BullMQ `emergency` job — the worker pages ops
 *          via FCM/SMS (stub today; spec §7).
 */
import { ForbiddenError, NotFoundError } from '@cravix/shared-errors';
import { logger } from '@cravix/shared-logger';
import { queues } from '@cravix/shared-queue';
import { redis } from '@cravix/shared-redis';
import type { EmergencyContact, MedicalInfo } from '@prisma/client';

import { emergencyRepository } from './repository.js';
import type {
  CreateContactInput,
  Relationship,
  SosTriggerInput,
  UpdateContactInput,
  UpdateMedicalInput,
} from './schemas.js';
import type {
  EmergencyContactDto,
  MedicalInfoDto,
  SosResponseDto,
} from './types.js';

// ─── Projection ────────────────────────────────────────────────

function projectContact(c: EmergencyContact): EmergencyContactDto {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    relationship: c.relationship as Relationship,
    isPrimary: c.isPrimary,
    createdAt: c.createdAt.toISOString(),
  };
}

function projectMedical(m: MedicalInfo | null): MedicalInfoDto {
  return {
    bloodGroup: m?.bloodGroup ?? null,
    allergies: m?.allergies ?? [],
    medicalConditions: m?.medicalConditions ?? [],
    medications: m?.medications ?? null,
    insurancePolicyNumber: m?.insurancePolicyNumber ?? null,
    updatedAt: m?.updatedAt.toISOString() ?? null,
  };
}

// ─── Public API ─────────────────────────────────────────────────

export const emergencyService = {
  async listContacts(riderId: string): Promise<EmergencyContactDto[]> {
    const rows = await emergencyRepository.listContacts(riderId);
    return rows.map(projectContact);
  },

  async createContact(riderId: string, input: CreateContactInput): Promise<EmergencyContactDto> {
    const existing = await emergencyRepository.listContacts(riderId);
    if (existing.length >= 5) {
      throw new ForbiddenError('Emergency contact limit reached (5)');
    }
    const isPrimary = input.isPrimary || existing.length === 0;
    const created = await emergencyRepository.createContact({
      riderId,
      name: input.name,
      phone: input.phone,
      relationship: input.relationship,
      isPrimary,
    });
    return projectContact(created);
  },

  async updateContact(
    riderId: string,
    contactId: string,
    input: UpdateContactInput,
  ): Promise<EmergencyContactDto> {
    const existing = await emergencyRepository.findContact({ riderId, contactId });
    if (!existing) throw new NotFoundError('Emergency contact not found');
    const patch: Parameters<typeof emergencyRepository.updateContact>[0]['patch'] = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.relationship !== undefined) patch.relationship = input.relationship;
    if (input.isPrimary !== undefined) patch.isPrimary = input.isPrimary;
    const updated = await emergencyRepository.updateContact({ riderId, contactId, patch });
    return projectContact(updated);
  },

  async deleteContact(riderId: string, contactId: string): Promise<{ count: number }> {
    return emergencyRepository.deleteContact({ riderId, contactId });
  },

  async getMedical(riderId: string): Promise<MedicalInfoDto> {
    const m = await emergencyRepository.getMedical(riderId);
    return projectMedical(m);
  },

  async updateMedical(riderId: string, input: UpdateMedicalInput): Promise<MedicalInfoDto> {
    const updated = await emergencyRepository.upsertMedical({ riderId, patch: input });
    return projectMedical(updated);
  },

  /**
   * SOS — durable record + realtime ops alert + queued FCM/SMS pages.
   *
   * Returns immediately so the rider sees an "ops alerted" confirmation; the
   * actual ops outreach is async via the BullMQ emergency queue (priority 1).
   */
  async triggerSos(riderId: string, input: SosTriggerInput): Promise<SosResponseDto> {
    const sos = await emergencyRepository.createSosEvent({
      riderId,
      type: input.type,
      latitude: input.latitude,
      longitude: input.longitude,
      ...(input.note !== undefined ? { note: input.note } : {}),
    });

    // 1. Cross-instance fan-out for the ops dashboard.
    try {
      await redis.publish(
        'cravix:events:emergency:sos',
        JSON.stringify({
          sosEventId: sos.id,
          riderId,
          type: input.type,
          latitude: input.latitude,
          longitude: input.longitude,
          note: input.note ?? null,
          createdAt: sos.createdAt.toISOString(),
        }),
      );
    } catch (e) {
      logger.error('sos publish failed', { err: (e as Error).message, riderId });
    }

    // 2. Priority-1 worker job — pages ops via FCM/SMS.
    await queues.emergency.add(
      'sos',
      {
        kind: 'sos',
        sosEventId: sos.id,
        riderId,
        latitude: input.latitude,
        longitude: input.longitude,
        type: input.type,
      },
      { priority: 1, attempts: 5, backoff: { type: 'exponential', delay: 1_000 } },
    );

    logger.warn('SOS triggered', { riderId, sosEventId: sos.id, type: input.type });

    return {
      sosEventId: sos.id,
      acknowledgedAt: new Date().toISOString(),
      estimatedResponseSeconds: 60,
    };
  },
};
