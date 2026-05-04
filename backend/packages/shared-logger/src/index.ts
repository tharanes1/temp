/**
 * Structured logger — Winston with JSON in prod, pretty-printed in dev.
 * Strips known PII keys before serialization. Never logs OTP, JWT, body of
 * /auth/verify, etc.
 */
import { Config, isProd } from '@cravix/shared-config';
import winston from 'winston';

const PII_KEYS = new Set([
  'otp',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'fcmtoken',
  'fcmToken',
  'aadhaarNumber',
  'panNumber',
  'accountNumber',
  'cvv',
]);

function redact<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = PII_KEYS.has(k) ? '[REDACTED]' : redact(v);
  }
  return out as T;
}

const baseFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format((info) => {
    // shallow-redact common fields and `meta`
    return redact(info);
  })(),
);

export const logger = winston.createLogger({
  level: Config.LOG_LEVEL,
  format: isProd()
    ? winston.format.combine(baseFormat, winston.format.json())
    : winston.format.combine(
        baseFormat,
        winston.format.colorize({ all: false }),
        winston.format.printf(({ level, message, timestamp, requestId, riderId, ...meta }) => {
          const tag = [requestId, riderId].filter(Boolean).join(' ');
          const tail = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
          return `${String(timestamp)} ${level} ${tag ? `[${tag}] ` : ''}${String(message)}${tail}`;
        }),
      ),
  defaultMeta: { service: 'cravix', instance: Config.INSTANCE_ID },
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

/** Helper: bind request-scoped context to every log line. */
export function child(meta: Record<string, unknown>) {
  return logger.child(meta);
}
