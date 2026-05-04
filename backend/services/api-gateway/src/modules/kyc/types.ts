/**
 * KYC wire-format DTOs.  Status enum strings match Prisma's `KycStatus`
 * lowercased.
 */

export type KycStatus =
  | 'not_started'
  | 'in_progress'
  | 'under_review'
  | 'verified'
  | 'rejected'
  | 'disabled';

export type KycStep =
  | 'category'
  | 'personal'
  | 'documents'
  | 'student'
  | 'disabled';

export interface KycStatusDto {
  status: KycStatus;
  completedSteps: KycStep[];
  pendingSteps: KycStep[];
  rejectionReason: string | null;
  category: 'freelancer' | 'fulltime' | null;
  subCategory: 'student' | 'professional' | 'disabled' | null;
  /** Derived: `completedSteps.length / requiredSteps.length` × 100, rounded. */
  progressPercent: number;
  submittedAt: string | null;
  reviewedAt: string | null;
}

export interface PresignedUploadDto {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
  contentType: string;
  expiresIn: number;
  maxBytes: number;
}
