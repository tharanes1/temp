/**
 * KYC service.  Implements spec §5.3 with locked decisions A3 + A4.
 *
 * Flow:
 *   1. Rider goes through CategoryScreen → POST /kyc/category
 *   2. PersonalScreen → POST /kyc/personal
 *   3. DocumentVerificationScreen — FOR EACH image:
 *        GET /kyc/s3-presigned-url?documentType=…&contentType=image/jpeg
 *        → client PUTs to S3
 *      → POST /kyc/documents with the public URLs
 *   4. (subCategory='student'  ⇒ POST /kyc/student)
 *      (subCategory='disabled' ⇒ POST /kyc/disabled)
 *   5. ReviewScreen GET /kyc/status — when all required steps complete,
 *      submitting transitions Rider.kycStatus → UNDER_REVIEW and enqueues
 *      a `kyc-verification` BullMQ job.
 */
import { ConflictError, ValidationError } from '@cravix/shared-errors';
import { logger } from '@cravix/shared-logger';
import { queues } from '@cravix/shared-queue';
import type { Category, Gender, KycApplication, SubCategory } from '@prisma/client';

import { isCravixS3Url, presignKycUpload, type PresignedUpload } from '../../shared/services/s3.js';

import { kycRepository } from './repository.js';
import type {
  CategoryInput,
  DocumentsInput,
  PersonalInput,
  PresignQuery,
  StudentInput,
  DisabledInput,
} from './schemas.js';
import type { KycStatusDto, KycStep } from './types.js';

// ─── Mappings ────────────────────────────────────────────────────

const CategoryToDb: Record<CategoryInput['category'], Category> = {
  freelancer: 'FREELANCER',
  fulltime: 'FULLTIME',
};
const SubCategoryToDb: Record<CategoryInput['subCategory'], SubCategory> = {
  student: 'STUDENT',
  professional: 'PROFESSIONAL',
  disabled: 'DISABLED',
};
const CategoryToWire: Record<Category, CategoryInput['category']> = {
  FREELANCER: 'freelancer',
  FULLTIME: 'fulltime',
};
const SubCategoryToWire: Record<SubCategory, CategoryInput['subCategory']> = {
  STUDENT: 'student',
  PROFESSIONAL: 'professional',
  DISABLED: 'disabled',
};

// ─── Status computation ──────────────────────────────────────────

function isCategoryComplete(app: KycApplication | null): boolean {
  return !!app?.category && !!app.subCategory;
}
function isPersonalComplete(rider: { name: string | null; gender: Gender | null; dateOfBirth: Date | null }, hasAddress: boolean): boolean {
  return !!rider.name && !!rider.gender && !!rider.dateOfBirth && hasAddress;
}
function isDocumentsComplete(app: KycApplication | null): boolean {
  if (!app) return false;
  return !!(app.aadhaarFront && app.aadhaarBack && app.panCard && app.drivingLicense && app.selfie);
}
function isStudentComplete(app: KycApplication | null): boolean {
  return !!(app?.collegeName && app.enrollmentNumber && app.collegeIdImage);
}
function isDisabledComplete(app: KycApplication | null): boolean {
  return !!(app?.disabilityCertNumber && app.disabilityDetails && app.disabilityProof);
}

function dbStatusToWire(s: string): KycStatusDto['status'] {
  return s.toLowerCase() as KycStatusDto['status'];
}

// ─── Public API ──────────────────────────────────────────────────

export const kycService = {
  /**
   * GET /kyc/status — composes the rider row, the KYC application, and the
   * address into a single progress report.
   */
  async getStatus(riderId: string): Promise<KycStatusDto> {
    const [app, riderRow] = await Promise.all([
      kycRepository.findByRiderId(riderId),
      // Pull the rider + address inline to avoid an N+1.
      (await import('../../config/database.js')).prisma.rider.findUnique({
        where: { id: riderId },
        select: {
          name: true,
          gender: true,
          dateOfBirth: true,
          kycStatus: true,
          address: { select: { id: true } },
        },
      }),
    ]);
    if (!riderRow) {
      throw new ValidationError('Rider not found');
    }

    const required: KycStep[] = ['category', 'personal', 'documents'];
    const completed: KycStep[] = [];
    if (isCategoryComplete(app)) completed.push('category');
    if (isPersonalComplete(riderRow, riderRow.address !== null)) completed.push('personal');
    if (isDocumentsComplete(app)) completed.push('documents');

    if (app?.subCategory === 'STUDENT') {
      required.push('student');
      if (isStudentComplete(app)) completed.push('student');
    }
    if (app?.subCategory === 'DISABLED') {
      required.push('disabled');
      if (isDisabledComplete(app)) completed.push('disabled');
    }

    const pending = required.filter((s) => !completed.includes(s));
    const progressPercent = Math.round((completed.length / required.length) * 100);

    return {
      status: dbStatusToWire(riderRow.kycStatus),
      completedSteps: completed,
      pendingSteps: pending,
      rejectionReason: app?.rejectionReason ?? null,
      category: app?.category ? CategoryToWire[app.category] : null,
      subCategory: app?.subCategory ? SubCategoryToWire[app.subCategory] : null,
      progressPercent,
      submittedAt: app?.submittedAt?.toISOString() ?? null,
      reviewedAt: app?.reviewedAt?.toISOString() ?? null,
    };
  },

  /**
   * POST /kyc/category — sets two-axis category (locked A4).  Changing it
   * back later (e.g. student → professional) is allowed up until KYC is
   * VERIFIED, so the same endpoint is idempotent for upserts.
   */
  async setCategory(riderId: string, input: CategoryInput): Promise<KycStatusDto> {
    await kycRepository.setCategory(riderId, CategoryToDb[input.category], SubCategoryToDb[input.subCategory]);
    return this.getStatus(riderId);
  },

  async setPersonal(riderId: string, input: PersonalInput): Promise<KycStatusDto> {
    await kycRepository.setPersonal({
      riderId,
      fullName: input.fullName,
      ...(input.email !== undefined ? { email: input.email } : {}),
      dateOfBirth: new Date(input.dateOfBirth),
      gender: input.gender.toUpperCase() as Gender,
      address: {
        line1: input.address.line1,
        ...(input.address.line2 !== undefined ? { line2: input.address.line2 } : {}),
        city: input.address.city,
        state: input.address.state,
        pincode: input.address.pincode,
        ...(input.address.district !== undefined ? { district: input.address.district } : {}),
        ...(input.address.latitude !== undefined ? { latitude: input.address.latitude } : {}),
        ...(input.address.longitude !== undefined ? { longitude: input.address.longitude } : {}),
      },
    });
    return this.getStatus(riderId);
  },

  /**
   * POST /kyc/documents — accepts any subset of {aadhaarFront, aadhaarBack,
   * panCard, drivingLicense, selfie}.  Each URL is validated against the
   * `cravix-*` allow-list (spec §14).
   */
  async setDocuments(riderId: string, input: DocumentsInput): Promise<KycStatusDto> {
    // URL allow-list
    for (const [field, url] of Object.entries(input)) {
      if (typeof url === 'string' && !isCravixS3Url(url)) {
        throw new ValidationError('Document URL not in cravix-* bucket', [
          { field, message: 'Must be an https URL inside the cravix-kyc bucket' },
        ]);
      }
    }
    const updated = await kycRepository.setDocuments(riderId, input);
    // If all five are now present, automatically transition to UNDER_REVIEW
    // and enqueue verification.  This way the ReviewScreen "Finalize" button
    // can be a passive ack, and an admin-side override never depends on a
    // client-driven submission.
    if (isDocumentsComplete(updated)) {
      const status = await this.getStatus(riderId);
      if (status.pendingSteps.length === 0 && status.status === 'in_progress') {
        await kycRepository.markSubmitted(riderId);
        await queues.kycVerification.add(
          'verify',
          { riderId, applicationId: updated.id },
          { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
        );
      }
    }
    return this.getStatus(riderId);
  },

  async setStudent(riderId: string, input: StudentInput): Promise<KycStatusDto> {
    if (!isCravixS3Url(input.collegeIdImage)) {
      throw new ValidationError('College ID URL not in cravix-* bucket', [
        { field: 'collegeIdImage', message: 'Must be an https URL inside the cravix-kyc bucket' },
      ]);
    }
    await kycRepository.setStudent(riderId, input);
    // Trigger transition if everything else is done — same pattern as setDocuments.
    return this.maybeAutoSubmit(riderId);
  },

  async setDisabled(riderId: string, input: DisabledInput): Promise<KycStatusDto> {
    if (!isCravixS3Url(input.disabilityProof)) {
      throw new ValidationError('Disability proof URL not in cravix-* bucket', [
        { field: 'disabilityProof', message: 'Must be an https URL inside the cravix-kyc bucket' },
      ]);
    }
    await kycRepository.setDisabled(riderId, input);
    return this.maybeAutoSubmit(riderId);
  },

  async getPresignedUpload(riderId: string, query: PresignQuery): Promise<PresignedUpload> {
    try {
      return await presignKycUpload({
        riderId,
        documentType: query.documentType,
        contentType: query.contentType,
      });
    } catch (e) {
      logger.error('presign failed', { riderId, err: (e as Error).message });
      throw new ValidationError('Failed to issue presigned URL');
    }
  },

  /**
   * Internal helper — call after any sub-flow completes to see whether the
   * application can transition to UNDER_REVIEW.  Idempotent.
   */
  async maybeAutoSubmit(riderId: string): Promise<KycStatusDto> {
    const status = await this.getStatus(riderId);
    if (status.status === 'in_progress' && status.pendingSteps.length === 0) {
      const app = await kycRepository.findByRiderId(riderId);
      if (app && !app.submittedAt) {
        await kycRepository.markSubmitted(riderId);
        await queues.kycVerification.add(
          'verify',
          { riderId, applicationId: app.id },
          { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
        );
        return this.getStatus(riderId);
      }
    }
    return status;
  },

  /**
   * Manual finalize — kept for the ReviewScreen "Finalize" button so the
   * rider gets explicit feedback rather than implicit transition.  Idempotent:
   * returns CONFLICT only if the rider is already verified or rejected.
   */
  async finalize(riderId: string): Promise<KycStatusDto> {
    const status = await this.getStatus(riderId);
    if (status.status === 'verified') {
      throw new ConflictError('KYC already verified');
    }
    if (status.status === 'rejected' || status.status === 'disabled') {
      throw new ConflictError(`KYC is ${status.status}; contact support`);
    }
    if (status.pendingSteps.length > 0) {
      throw new ValidationError('KYC is incomplete', status.pendingSteps.map((s) => ({ field: s, message: 'pending' })));
    }
    return this.maybeAutoSubmit(riderId);
  },
};
