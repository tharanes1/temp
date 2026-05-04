/**
 * Auth service — business logic. No DB calls (delegated to repository); no
 * HTTP concerns (delegated to controller).
 *
 * Locked decisions:
 *   A1 — OTP_LENGTH = 4
 *   A2 — token = access (3m); refreshToken (2d); one-time-use refresh rotation;
 *        token-reuse detection (presenting an already-rotated refresh revokes
 *        the rider's current session entirely).
 */
import { randomInt } from 'node:crypto';

import { Config } from '@cravix/shared-config';
import {
  ConflictError,
  OtpExpiredError,
  OtpInvalidError,
  OtpLockedError,
  TokenReuseDetectedError,
  UnauthorizedError,
} from '@cravix/shared-errors';
import { logger } from '@cravix/shared-logger';
import { queues } from '@cravix/shared-queue';
import { redis, RedisKeys } from '@cravix/shared-redis';
import bcrypt from 'bcryptjs';

import { mintAccess, mintRefresh, verifyRefreshToken } from '../../shared/utils/jwt.js';

import { authRepository } from './repository.js';
import type { AuthUserDto, RefreshResponseDto, VerifyOtpResponseDto } from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────

function generateOtp(length: number): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(randomInt(min, max));
}

async function setRefreshHash(riderId: string, jti: string, refreshToken: string, ttlSec: number) {
  // Single-device policy: replace any prior refresh key for this rider.
  const hash = await bcrypt.hash(`${jti}:${refreshToken}`, 8);
  await redis.set(RedisKeys.refresh(riderId), `${jti}:${hash}`, 'EX', ttlSec);
}

async function compareRefreshHash(riderId: string, jti: string, refreshToken: string): Promise<'ok' | 'reuse' | 'missing'> {
  const stored = await redis.get(RedisKeys.refresh(riderId));
  if (!stored) return 'missing';
  const sep = stored.indexOf(':');
  if (sep < 0) return 'missing';
  const storedJti = stored.slice(0, sep);
  const storedHash = stored.slice(sep + 1);
  if (storedJti !== jti) return 'reuse';
  const ok = await bcrypt.compare(`${jti}:${refreshToken}`, storedHash);
  return ok ? 'ok' : 'reuse';
}

async function deleteRefresh(riderId: string) {
  await redis.del(RedisKeys.refresh(riderId));
}

function projectUser(rider: { id: string; phone: string; name: string | null; profileImage: string | null; consentGivenAt: Date | null; kycStatus: string }): AuthUserDto {
  return {
    id: rider.id,
    phone: rider.phone,
    name: rider.name,
    profileImage: rider.profileImage,
    isKycComplete: rider.kycStatus === 'VERIFIED',
    consentAccepted: rider.consentGivenAt !== null,
  };
}

// ─── Public API ──────────────────────────────────────────────────

export const authService = {
  /**
   * Initiate OTP login. Generates a 4-digit OTP, stores `bcrypt(otp)` in Redis
   * with 5-min TTL, and enqueues an SMS dispatch job. Never reveals whether the
   * phone is registered.
   *
   * Returns `expiresIn` (seconds) so the client can countdown.
   */
  async initiateLogin(phone: string, ip: string | null, ua: string | null): Promise<{ expiresIn: number }> {
    // Check inflight OTP — if one is already pending, refuse to overwrite to
    // avoid SMS-bombing scenarios. The express rate limiter already caps 5/10min.
    const existing = await redis.exists(RedisKeys.otp(phone));
    if (existing) {
      const ttl = await redis.ttl(RedisKeys.otp(phone));
      // Resilient: if the rider didn't receive the SMS, allow re-issue once it's
      // in the last minute of validity. This trades a little SMS cost for UX.
      if (ttl > 60) {
        throw new ConflictError('An OTP was already sent. Please wait before requesting another.');
      }
    }

    const otp = generateOtp(Config.OTP_LENGTH);
    const hash = await bcrypt.hash(otp, Config.OTP_BCRYPT_ROUNDS);
    await redis.set(RedisKeys.otp(phone), hash, 'EX', Config.OTP_TTL_SECONDS);

    // Reset attempt counter on every fresh OTP issue.
    await redis.del(RedisKeys.otpAttempts(phone));

    // Enqueue SMS dispatch via BullMQ.  The notifications worker delivers via
    // MSG91 in production; in dev it logs the OTP at warn level so curl flows
    // remain testable without provider creds.
    await queues.notifications.add(
      'sms-otp',
      { kind: 'sms-otp', phone, otp, ttlSec: Config.OTP_TTL_SECONDS },
      { attempts: 3, backoff: { type: 'exponential', delay: 2_000 } },
    );
    if (Config.NODE_ENV !== 'production') {
      logger.warn(`[auth] DEV OTP for ${phone}: ${otp}`, { phone });
    }

    await authRepository.logAuthEvent({
      type: 'OTP_SENT',
      ip,
      userAgent: ua,
      metadata: { phone },
    });

    return { expiresIn: Config.OTP_TTL_SECONDS };
  },

  /**
   * Verify OTP, mint access + refresh, persist refresh-hash in Redis (single
   * device policy — overwrites any prior token). Returns spec-shaped DTO.
   */
  async verifyOtp(args: {
    phone: string;
    otp: string;
    consentVersion?: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<VerifyOtpResponseDto> {
    const { phone, otp } = args;

    // Lockout check first — cheap.
    const attemptsRaw = await redis.get(RedisKeys.otpAttempts(phone));
    const attempts = attemptsRaw ? Number.parseInt(attemptsRaw, 10) : 0;
    if (attempts >= Config.OTP_MAX_ATTEMPTS) {
      throw new OtpLockedError();
    }

    const stored = await redis.get(RedisKeys.otp(phone));
    if (!stored) {
      await authRepository.logAuthEvent({ type: 'OTP_EXPIRED', ip: args.ip, userAgent: args.userAgent, metadata: { phone } });
      throw new OtpExpiredError();
    }

    const ok = await bcrypt.compare(otp, stored);
    if (!ok) {
      const next = await redis.incr(RedisKeys.otpAttempts(phone));
      if (next === 1) await redis.expire(RedisKeys.otpAttempts(phone), Config.OTP_LOCK_TTL_SECONDS);
      await authRepository.logAuthEvent({
        type: 'OTP_FAILED',
        ip: args.ip,
        userAgent: args.userAgent,
        metadata: { phone, attempt: next },
      });
      if (next >= Config.OTP_MAX_ATTEMPTS) throw new OtpLockedError();
      throw new OtpInvalidError();
    }

    // Single-use OTP — delete the keys so the same code can never be reused.
    await Promise.all([
      redis.del(RedisKeys.otp(phone)),
      redis.del(RedisKeys.otpAttempts(phone)),
    ]);

    // Upsert rider (may be first-ever login).
    const rider = await authRepository.upsertRider(phone);

    // Optional first-login consent capture
    if (args.consentVersion && !rider.consentGivenAt) {
      await authRepository.setConsent(rider.id, args.consentVersion);
      rider.consentVersion = args.consentVersion;
      rider.consentGivenAt = new Date();
    }

    const access = mintAccess({ riderId: rider.id, phone: rider.phone });
    const refresh = mintRefresh({ riderId: rider.id, phone: rider.phone });
    await setRefreshHash(rider.id, refresh.jti, refresh.token, refresh.expiresIn);

    await authRepository.logAuthEvent({
      riderId: rider.id,
      type: 'OTP_VERIFIED',
      ip: args.ip,
      userAgent: args.userAgent,
      metadata: { jti: access.jti },
    });

    return {
      token: access.token,
      refreshToken: refresh.token,
      expiresIn: access.expiresIn,
      refreshExpiresIn: refresh.expiresIn,
      user: projectUser(rider),
    };
  },

  /**
   * Refresh — one-time-use rotation with reuse-detection.
   *
   * Flow:
   *   1. Verify JWT signature + claims (type=refresh).
   *   2. Compare jti against Redis. If missing → 401. If mismatch → token reuse:
   *      revoke ALL sessions for this rider (delete the key) and 401.
   *   3. Mint new access + new refresh, replace Redis hash atomically.
   */
  async refresh(refreshToken: string, ip: string | null, ua: string | null): Promise<RefreshResponseDto> {
    const decoded = verifyRefreshToken(refreshToken);
    const riderId = decoded.sub;
    const phone = decoded.phone;

    const status = await compareRefreshHash(riderId, decoded.jti, refreshToken);
    if (status === 'missing') {
      await authRepository.logAuthEvent({ riderId, type: 'REFRESH_MISSING', ip, userAgent: ua });
      throw new UnauthorizedError('Refresh token revoked or expired');
    }
    if (status === 'reuse') {
      // Token reuse — likely theft. Revoke all sessions; force re-login.
      await deleteRefresh(riderId);
      await authRepository.logAuthEvent({ riderId, type: 'TOKEN_REUSE', ip, userAgent: ua });
      throw new TokenReuseDetectedError();
    }

    const access = mintAccess({ riderId, phone });
    const refresh = mintRefresh({ riderId, phone });
    // Replace atomically — overwrite via SET (TTL refreshes too).
    await setRefreshHash(riderId, refresh.jti, refresh.token, refresh.expiresIn);

    await authRepository.logAuthEvent({
      riderId,
      type: 'REFRESH',
      ip,
      userAgent: ua,
      metadata: { newJti: access.jti },
    });

    return {
      token: access.token,
      refreshToken: refresh.token,
      expiresIn: access.expiresIn,
      refreshExpiresIn: refresh.expiresIn,
    };
  },

  /** Logout — revoke refresh token. Idempotent: returns success if already gone. */
  async logout(riderId: string, ip: string | null, ua: string | null): Promise<void> {
    await deleteRefresh(riderId);
    await authRepository.logAuthEvent({ riderId, type: 'LOGOUT', ip, userAgent: ua });
  },
};
