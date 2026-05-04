/**
 * Wire-format DTOs shared between backend and frontend.
 * Locked decision A6: money on the wire is `number` rupees with up to 2 decimals.
 */
import { z } from 'zod';

// ─── Envelope ─────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: true;
  message?: string;
  data: T;
}

export interface ApiPaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
  requestId: string;
}

// ─── Phone (locked: India only) ───────────────────────────────────
export const IndianPhoneRegex = /^\+91[6-9]\d{9}$/;
export const PhoneSchema = z.string().regex(IndianPhoneRegex, 'Invalid Indian mobile number');

// ─── Auth DTOs ────────────────────────────────────────────────────
// Locked decision A1: 4-digit OTP
export const OtpStringSchema = z.string().regex(/^\d{4}$/, 'OTP must be 4 digits');

export interface AuthUserDto {
  id: string;
  phone: string;
  name: string | null;
  isKycComplete: boolean;
  profileImage: string | null;
  consentAccepted: boolean;
}

/**
 * Locked decision A2:
 *   • `token` is the **access** token (3 minutes)  ← what the FE already reads
 *   • `refreshToken` (2 days) is new
 *   • `expiresIn` is the access-token lifetime in seconds (so FE can schedule refresh)
 *   • `refreshExpiresIn` mirrors for refresh
 */
export interface VerifyOtpResponseDto {
  token: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  user: AuthUserDto;
}

export interface RefreshResponseDto {
  token: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

// ─── Money (locked decision A6) ───────────────────────────────────
/** Rupees with up to 2 decimals. Always non-negative on the wire. */
export const MoneySchema = z
  .number()
  .nonnegative()
  .multipleOf(0.01, 'Money values must have at most 2 decimal places');

// ─── Pagination ──────────────────────────────────────────────────
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
