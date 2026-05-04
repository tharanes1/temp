/**
 * KYC service — wraps /api/v1/kyc/*.
 *
 * Locked decisions reflected in the DTOs:
 *   A3 — documents are {aadhaarFront, aadhaarBack, panCard, drivingLicense, selfie}
 *   A4 — category is two-axis: {category: 'freelancer'|'fulltime', subCategory: 'student'|'professional'|'disabled'}
 *
 * Includes the `uploadKycDocument` helper that GETs a presigned PUT URL,
 * uploads the local file directly to S3, and returns the public URL the
 * caller should subsequently send to /kyc/{documents,student,disabled}.
 */
import apiClient from '../client';

// ─── Endpoint constants ─────────────────────────────────────────

export const KYC_ENDPOINTS = {
  STATUS: '/api/v1/kyc/status',
  CATEGORY: '/api/v1/kyc/category',
  PERSONAL: '/api/v1/kyc/personal',
  DOCUMENTS: '/api/v1/kyc/documents',
  STUDENT: '/api/v1/kyc/student',
  DISABLED: '/api/v1/kyc/disabled',
  PRESIGN: '/api/v1/kyc/s3-presigned-url',
  FINALIZE: '/api/v1/kyc/finalize',
} as const;

// ─── DTOs ───────────────────────────────────────────────────────

export type KycStatusValue =
  | 'not_started'
  | 'in_progress'
  | 'under_review'
  | 'verified'
  | 'rejected'
  | 'disabled';

export type KycStep = 'category' | 'personal' | 'documents' | 'student' | 'disabled';

export interface KycStatus {
  status: KycStatusValue;
  completedSteps: KycStep[];
  pendingSteps: KycStep[];
  rejectionReason: string | null;
  category: 'freelancer' | 'fulltime' | null;
  subCategory: 'student' | 'professional' | 'disabled' | null;
  progressPercent: number;
  submittedAt: string | null;
  reviewedAt: string | null;
}

export interface CategoryBody {
  category: 'freelancer' | 'fulltime';
  subCategory: 'student' | 'professional' | 'disabled';
}

export interface PersonalBody {
  fullName: string;
  email?: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'male' | 'female' | 'other';
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
}

export interface DocumentsBody {
  aadhaarFront?: string;
  aadhaarBack?: string;
  panCard?: string;
  drivingLicense?: string;
  selfie?: string;
}

export interface StudentBody {
  collegeName: string;
  enrollmentNumber: string;
  collegeIdImage: string;
}

export interface DisabledBody {
  disabilityCertNumber: string;
  disabilityDetails: string;
  disabilityProof: string;
}

export type DocumentType =
  | 'aadhaarFront'
  | 'aadhaarBack'
  | 'panCard'
  | 'drivingLicense'
  | 'selfie'
  | 'collegeIdImage'
  | 'disabilityProof';

export type UploadContentType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface PresignedUpload {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
  contentType: UploadContentType;
  expiresIn: number;
  maxBytes: number;
}

interface ApiEnvelope<T> {
  success: true;
  data: T;
}

// ─── Service ────────────────────────────────────────────────────

export const kycService = {
  async getStatus(): Promise<KycStatus> {
    const { data } = await apiClient.get<ApiEnvelope<KycStatus>>(KYC_ENDPOINTS.STATUS);
    return data.data;
  },

  async setCategory(body: CategoryBody): Promise<KycStatus> {
    const { data } = await apiClient.post<ApiEnvelope<KycStatus>>(KYC_ENDPOINTS.CATEGORY, body);
    return data.data;
  },

  async setPersonal(body: PersonalBody): Promise<KycStatus> {
    const { data } = await apiClient.post<ApiEnvelope<KycStatus>>(KYC_ENDPOINTS.PERSONAL, body);
    return data.data;
  },

  async setDocuments(body: DocumentsBody): Promise<KycStatus> {
    const { data } = await apiClient.post<ApiEnvelope<KycStatus>>(KYC_ENDPOINTS.DOCUMENTS, body);
    return data.data;
  },

  async setStudent(body: StudentBody): Promise<KycStatus> {
    const { data } = await apiClient.post<ApiEnvelope<KycStatus>>(KYC_ENDPOINTS.STUDENT, body);
    return data.data;
  },

  async setDisabled(body: DisabledBody): Promise<KycStatus> {
    const { data } = await apiClient.post<ApiEnvelope<KycStatus>>(KYC_ENDPOINTS.DISABLED, body);
    return data.data;
  },

  async getPresignedUpload(documentType: DocumentType, contentType: UploadContentType): Promise<PresignedUpload> {
    const { data } = await apiClient.get<ApiEnvelope<PresignedUpload>>(KYC_ENDPOINTS.PRESIGN, {
      params: { documentType, contentType },
    });
    return data.data;
  },

  async finalize(): Promise<KycStatus> {
    const { data } = await apiClient.post<ApiEnvelope<KycStatus>>(KYC_ENDPOINTS.FINALIZE);
    return data.data;
  },
};

// ─── Upload helper ──────────────────────────────────────────────

/** Heuristic file-extension → MIME mapping for `expo-image-picker` URIs. */
function inferContentType(uri: string): UploadContentType {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * End-to-end KYC upload:
 *   1. GET /kyc/s3-presigned-url for the given documentType
 *   2. PUT the file to S3 (or the dev mock host)
 *   3. Return the public URL the caller will send to /kyc/* endpoints
 *
 * Throws on any failure with a descriptive message.
 */
export async function uploadKycDocument(
  documentType: DocumentType,
  localUri: string,
): Promise<string> {
  const contentType = inferContentType(localUri);
  const presigned = await kycService.getPresignedUpload(documentType, contentType);

  // Validate file size before uploading so we don't waste network on rejects.
  let blob: Blob;
  let size: number;
  try {
    const fileResp = await fetch(localUri);
    blob = await fileResp.blob();
    size = blob.size;
  } catch (e) {
    throw new Error(`Could not read local file: ${(e as Error).message}`);
  }
  if (size > presigned.maxBytes) {
    throw new Error(`File exceeds ${Math.round(presigned.maxBytes / 1024 / 1024)} MB limit`);
  }

  // Mock mode short-circuits when we can detect a dev mock signature.
  if (presigned.uploadUrl.includes('X-Cravix-Mock=1')) {
    return presigned.publicUrl;
  }

  const putResp = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!putResp.ok) {
    throw new Error(`S3 upload failed: ${putResp.status} ${putResp.statusText}`);
  }
  return presigned.publicUrl;
}
