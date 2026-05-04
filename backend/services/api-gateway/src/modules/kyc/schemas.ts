/**
 * Zod schemas for the KYC module.
 *
 * Locked decisions:
 *   A3 — `documents` accepts {aadhaarFront, aadhaarBack, panCard, drivingLicense, selfie}
 *   A4 — `category` is two-axis: {category: 'freelancer'|'fulltime'} × {subCategory: 'student'|'professional'|'disabled'}
 */
import { z } from 'zod';

// ─── Category (locked A4) ────────────────────────────────────────

export const CategorySchema = z
  .object({
    category: z.enum(['freelancer', 'fulltime']),
    subCategory: z.enum(['student', 'professional', 'disabled']),
  })
  .strict();

export type CategoryInput = z.infer<typeof CategorySchema>;

// ─── Personal ────────────────────────────────────────────────────

const PinCodeRegex = /^[1-9]\d{5}$/; // Indian PIN

export const PersonalSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email().max(255).optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .refine(
        (v) => {
          const d = new Date(v);
          if (Number.isNaN(d.valueOf())) return false;
          const y = d.getFullYear();
          return y >= 1940 && y <= 2014; // 18-85 in 2026
        },
        { message: 'Date of birth must be between 1940 and 2014' },
      ),
    gender: z.enum(['male', 'female', 'other']),
    address: z
      .object({
        line1: z.string().trim().min(2).max(200),
        line2: z.string().trim().max(200).optional(),
        city: z.string().trim().min(2).max(80),
        state: z.string().trim().min(2).max(80),
        pincode: z.string().regex(PinCodeRegex, 'Invalid Indian PIN code'),
        district: z.string().trim().max(80).optional(),
        latitude: z.number().gte(-90).lte(90).optional(),
        longitude: z.number().gte(-180).lte(180).optional(),
      })
      .strict(),
  })
  .strict();

export type PersonalInput = z.infer<typeof PersonalSchema>;

// ─── Documents (locked A3) ───────────────────────────────────────
// Partial body permitted — riders can upload progressively, the
// completion check lives in `GET /kyc/status`.

const S3UrlSchema = z.string().url().max(2048);

export const DocumentsSchema = z
  .object({
    aadhaarFront: S3UrlSchema.optional(),
    aadhaarBack: S3UrlSchema.optional(),
    panCard: S3UrlSchema.optional(),
    drivingLicense: S3UrlSchema.optional(),
    selfie: S3UrlSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one document URL must be provided' });

export type DocumentsInput = z.infer<typeof DocumentsSchema>;

// ─── Student ─────────────────────────────────────────────────────

export const StudentSchema = z
  .object({
    collegeName: z.string().trim().min(2).max(120),
    enrollmentNumber: z.string().trim().min(2).max(40),
    collegeIdImage: S3UrlSchema,
  })
  .strict();

export type StudentInput = z.infer<typeof StudentSchema>;

// ─── Disabled (locked spec gap §6.6 — formally added) ───────────

export const DisabledSchema = z
  .object({
    disabilityCertNumber: z.string().trim().min(4).max(40),
    disabilityDetails: z.string().trim().min(20).max(600),
    disabilityProof: S3UrlSchema,
  })
  .strict();

export type DisabledInput = z.infer<typeof DisabledSchema>;

// ─── S3 presigned-URL query ──────────────────────────────────────

export const KycDocumentTypes = [
  'aadhaarFront',
  'aadhaarBack',
  'panCard',
  'drivingLicense',
  'selfie',
  'collegeIdImage',
  'disabilityProof',
] as const;

export const PresignQuerySchema = z
  .object({
    documentType: z.enum(KycDocumentTypes),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  })
  .strict();

export type PresignQuery = z.infer<typeof PresignQuerySchema>;
