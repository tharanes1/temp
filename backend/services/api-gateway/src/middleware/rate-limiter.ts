/**
 * Express rate-limit with Redis store, so limits are shared across all 8
 * instances (spec §14). Three named limiters are exported.
 */
import { Config } from '@cravix/shared-config';
import { redis } from '@cravix/shared-redis';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

const sendCommand = (...args: string[]) => redis.call(...args) as unknown as Promise<string>;

const baseStore = (prefix: string) =>
  new RedisStore({
    sendCommand,
    prefix: `${Config.REDIS_KEY_PREFIX}rl:${prefix}:`,
  });

const handler = (key: string) => ({
  windowMs: 0,
  max: 0,
  store: baseStore(key),
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests' },
  },
});

/** Global 100 req / 60s / IP — applied per-router to expose specific paths. */
export const globalLimiter = rateLimit({
  ...handler('global'),
  windowMs: Config.RATE_LIMIT_WINDOW_MS,
  max: Config.RATE_LIMIT_MAX_REQUESTS,
});

/** OTP 5 / 10 min / phone — keyed by request body phone (set in route). */
export const otpLimiter = rateLimit({
  ...handler('otp'),
  windowMs: Config.OTP_RATE_LIMIT_WINDOW_MS,
  max: Config.OTP_RATE_LIMIT_MAX,
  keyGenerator: (req) => {
    const body = req.body as { phone?: string } | undefined;
    return `phone:${body?.phone ?? req.ip ?? 'unknown'}`;
  },
});

/** Refresh 30 / hour / rider — keyed by riderId from token claim if present. */
export const refreshLimiter = rateLimit({
  ...handler('refresh'),
  windowMs: Config.REFRESH_RATE_LIMIT_WINDOW_MS,
  max: Config.REFRESH_RATE_LIMIT_MAX,
});

/** Withdraw 3 / 24h / rider — used by wallet slice later. */
export const withdrawLimiter = rateLimit({
  ...handler('withdraw'),
  windowMs: Config.WITHDRAW_RATE_LIMIT_WINDOW_MS,
  max: Config.WITHDRAW_RATE_LIMIT_MAX,
});
