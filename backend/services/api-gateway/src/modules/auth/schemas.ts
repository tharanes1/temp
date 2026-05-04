/**
 * Zod schemas for the Auth module — the only validation layer (spec §15).
 *
 * Locked decisions:
 *   A1 — OTP is 4 digits
 *   A2 — Refresh-token endpoint exists; access(3m) + refresh(2d) lifetimes
 */
import { OtpStringSchema, PhoneSchema } from '@cravix/shared-types';
import { z } from 'zod';

export const LoginSchema = z.object({
  phone: PhoneSchema,
});

export const VerifyOtpSchema = z.object({
  phone: PhoneSchema,
  otp: OtpStringSchema, // 4 digits — locked A1
  // Optional consent capture on first login (DPDPA — §0 ops defaults)
  consentVersion: z.string().regex(/^v\d+(\.\d+){0,2}$/).optional(),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(20).max(2048),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type RefreshInput = z.infer<typeof RefreshSchema>;
