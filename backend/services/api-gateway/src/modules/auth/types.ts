/**
 * Module-local DTOs. Shared cross-service DTOs live in @cravix/shared-types.
 */
import type { AuthUserDto, RefreshResponseDto, VerifyOtpResponseDto } from '@cravix/shared-types';

export type { AuthUserDto, RefreshResponseDto, VerifyOtpResponseDto };

export interface LoginResultDto {
  expiresIn: number; // seconds until OTP expires
}

export interface OtpDispatchJob {
  phone: string;
  otp: string;
  templateId: string | null;
  ttlSec: number;
}
