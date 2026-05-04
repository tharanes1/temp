/**
 * ioredis singletons.
 *
 * Spec §2: every instance must share the same Redis. This module exposes:
 *   • redis        — main client (sharded pool internally)
 *   • redisPub     — Socket.IO redis-adapter pub client
 *   • redisSub     — Socket.IO redis-adapter sub client
 *   • prefixKey()  — applies REDIS_KEY_PREFIX so all keys are namespaced
 *   • RedisKeys    — builders for every documented key pattern (spec §8)
 */
import { Config } from '@cravix/shared-config';
import { logger } from '@cravix/shared-logger';
import IORedis, { type Redis } from 'ioredis';

function build(name: string): Redis {
  const client = new IORedis(Config.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    reconnectOnError(err) {
      logger.warn(`[redis:${name}] reconnect on error`, { err: err.message });
      return true;
    },
  });
  client.on('error', (err) => logger.error(`[redis:${name}] error`, { err: err.message }));
  client.on('end', () => logger.warn(`[redis:${name}] connection ended`));
  client.on('ready', () => logger.info(`[redis:${name}] ready`));
  return client;
}

export const redis: Redis = build('main');
export const redisPub: Redis = build('pub');
export const redisSub: Redis = build('sub');

export const prefixKey = (k: string) => `${Config.REDIS_KEY_PREFIX}${k}`;

/** Centralized Redis key builder — single source of truth (spec §8). */
export const RedisKeys = {
  riderStatus: (id: string) => prefixKey(`rider:status:${id}`),
  riderLocation: (id: string) => prefixKey(`rider:location:${id}`),
  riderLocations: () => prefixKey(`rider:locations`),
  riderFcm: (id: string) => prefixKey(`rider:fcm:${id}`),
  socketRider: (id: string) => prefixKey(`socket:rider:${id}`),

  otp: (phone: string) => prefixKey(`otp:${phone}`),
  otpAttempts: (phone: string) => prefixKey(`otp:attempts:${phone}`),
  otpRateLimit: (phone: string) => prefixKey(`ratelimit:otp:${phone}`),

  refresh: (riderId: string) => prefixKey(`refresh:${riderId}`),

  orderPending: (orderId: string) => prefixKey(`order:pending:${orderId}`),
  orderAssigned: (orderId: string) => prefixKey(`order:assigned:${orderId}`),

  cacheRiderProfile: (id: string) => prefixKey(`cache:rider:profile:${id}`),
  cacheEarnings: (riderId: string, period: string) =>
    prefixKey(`cache:earnings:${riderId}:${period}`),
  cacheLeaderboard: (period: string, city: string) =>
    prefixKey(`cache:leaderboard:${period}:${city}`),
  cacheZones: (city: string) => prefixKey(`cache:zones:${city}`),
  cacheHeatmap: (city: string) => prefixKey(`cache:heatmap:${city}`),
  cacheGeocode: (lat: string, lng: string) => prefixKey(`cache:geocode:${lat}:${lng}`),
} as const;

/** Tiny helper for cache-aside pattern. */
export async function cacheAside<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await redis.get(key);
  if (hit) {
    try {
      return JSON.parse(hit) as T;
    } catch {
      // fall through to reload
    }
  }
  const fresh = await loader();
  await redis.set(key, JSON.stringify(fresh), 'EX', ttlSec);
  return fresh;
}

export async function disconnectAll(): Promise<void> {
  await Promise.all([redis.quit(), redisPub.quit(), redisSub.quit()]);
}
