/**
 * Cravix shared configuration loader.
 *
 * Reads process.env once at boot, validates with Zod, exports a frozen Config
 * object. Any consumer that imports `Config` is guaranteed to receive
 * type-safe, validated values — no runtime `process.env.X` lookups elsewhere.
 *
 * Locked decisions reflected here:
 *   A1 — OTP_LENGTH default 4
 *   A2 — JWT_ACCESS_EXPIRY default 3m, JWT_REFRESH_EXPIRY default 2d
 */
import 'dotenv/config';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
const csv = (s: string) => s.split(',').map((v) => v.trim()).filter(Boolean);

const intLike = z
  .string()
  .regex(/^\d+$/, 'must be a non-negative integer')
  .transform((v) => Number.parseInt(v, 10));

const boolLike = z
  .string()
  .transform((v) => ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()));

const expiryLike = z
  .string()
  .regex(/^\d+(s|m|h|d)$/, 'must look like 30s | 5m | 2h | 7d');

// ─────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────
const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: intLike.default('3000'),
  SOCKET_PORT: intLike.default('5000'),
  HOST: z.string().default('0.0.0.0'),
  INSTANCE_ID: intLike.default('1'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  REDIS_KEY_PREFIX: z.string().default('cravix:'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: expiryLike.default('3m'),
  JWT_REFRESH_EXPIRY: expiryLike.default('2d'),
  JWT_ISSUER: z.string().default('cravix-rider-api'),
  JWT_AUDIENCE: z.string().default('cravix-rider-app'),
  JWT_ACCESS_SECRET_PREVIOUS: z.string().optional(),

  RATE_LIMIT_WINDOW_MS: intLike.default('60000'),
  RATE_LIMIT_MAX_REQUESTS: intLike.default('100'),
  OTP_RATE_LIMIT_WINDOW_MS: intLike.default('600000'),
  OTP_RATE_LIMIT_MAX: intLike.default('5'),
  WITHDRAW_RATE_LIMIT_WINDOW_MS: intLike.default('86400000'),
  WITHDRAW_RATE_LIMIT_MAX: intLike.default('3'),
  REFRESH_RATE_LIMIT_WINDOW_MS: intLike.default('3600000'),
  REFRESH_RATE_LIMIT_MAX: intLike.default('30'),

  ALLOWED_ORIGINS: z.string().default('').transform(csv),

  MAX_BODY_SIZE: z.string().default('10kb'),
  TRUSTED_PROXIES: intLike.default('1'),

  // OTP — locked decision A1
  OTP_LENGTH: intLike.default('4'),
  OTP_TTL_SECONDS: intLike.default('300'),
  OTP_MAX_ATTEMPTS: intLike.default('5'),
  OTP_LOCK_TTL_SECONDS: intLike.default('900'),
  OTP_BCRYPT_ROUNDS: intLike.default('10'),

  // S3
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_S3_BUCKET: z.string().default('cravix-kyc'),
  AWS_S3_CDN_BUCKET: z.string().default('cravix-cdn'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PRESIGNED_URL_TTL: intLike.default('300'),
  S3_MAX_UPLOAD_BYTES: intLike.default('5242880'),

  // External services (optional during dev)
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  MSG91_SENDER_ID: z.string().default('CRAVIX'),
  FCM_SERVICE_ACCOUNT_JSON: z.string().optional(),

  PAYMENT_GATEWAY: z.enum(['razorpay', 'cashfree', 'mock']).default('mock'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

let cached: Config | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached;

  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n');
    // Use throw + console.error to avoid relying on the logger at boot
    console.error(`[shared-config] invalid environment:\n${issues}`);
    throw new Error('Invalid environment configuration');
  }

  cached = Object.freeze(parsed.data);
  return cached;
}

/** Singleton accessor — first call validates, subsequent calls return cached. */
export const Config = new Proxy({} as Config, {
  get(_t, prop) {
    return loadConfig()[prop as keyof Config];
  },
});

export const isProd = () => loadConfig().NODE_ENV === 'production';
export const isDev = () => loadConfig().NODE_ENV === 'development';
export const isTest = () => loadConfig().NODE_ENV === 'test';
