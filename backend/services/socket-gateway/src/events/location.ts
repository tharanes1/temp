/**
 * `locationUpdate` handler.
 *
 * Spec §13 cardinal rule #1: NEVER write to Postgres in this handler.  The
 * payload is enqueued to BullMQ `location-updates` and a worker batches the
 * actual DB writes every 30 seconds (spec §7).
 *
 * In-memory throttle: the payload is also written to a Redis GeoSet so the
 * assignment engine has sub-second resolution.  We do NOT throttle here —
 * the client already throttles via `expo-location` (5 s / 10 m).
 */
import { logger } from '@cravix/shared-logger';
import { redis, RedisKeys } from '@cravix/shared-redis';
import { queues } from '@cravix/shared-queue';
import type { Socket } from 'socket.io';
import { z } from 'zod';

import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../types.js';

const LocationPayloadSchema = z
  .object({
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    heading: z.number().gte(0).lt(360).optional(),
    speed: z.number().gte(0).lte(200).optional(),
    accuracy: z.number().gte(0).lte(10_000).optional(),
    capturedAt: z.number().int().positive().optional(),
  })
  .strict();

export function bindLocationHandler(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
): void {
  const { riderId } = socket.data;

  socket.on('locationUpdate', async (payload, ack) => {
    const parsed = LocationPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      // Invalid payload → log + nack.  Do NOT disconnect — a single malformed
      // packet on a flaky network shouldn't kick the rider off-line.
      logger.warn('locationUpdate: validation failed', {
        riderId,
        issues: parsed.error.issues.map((i) => i.message).slice(0, 3),
      });
      ack?.(false);
      return;
    }

    const { latitude, longitude, heading, speed, accuracy } = parsed.data;
    const capturedAt = parsed.data.capturedAt ?? Date.now();

    try {
      // (1) GeoSet — sub-second freshness for the assignment engine.
      //     "lng then lat" is the GEOADD argument order.
      // (2) Live pointer — used by /rider/status display lookups.
      await Promise.all([
        redis.geoadd(RedisKeys.riderLocations(), longitude, latitude, riderId),
        redis.set(
          RedisKeys.riderLocation(riderId),
          JSON.stringify({ lat: latitude, lng: longitude, heading, speed, ts: capturedAt }),
          'EX',
          30, // spec §8 — TTL 30s
        ),
      ]);

      // (3) Enqueue the durable persistence job — non-blocking.
      void queues.locationUpdates.add(
        'ping',
        { riderId, latitude, longitude, heading, speed, accuracy, capturedAt },
        { removeOnComplete: { age: 600, count: 10_000 } },
      );

      ack?.(true);
    } catch (e) {
      logger.error('locationUpdate: enqueue failed', { riderId, err: (e as Error).message });
      ack?.(false);
    }
  });

  // When the socket goes away, drop the live pointer immediately so the
  // assignment engine can't pick this rider until they reconnect.
  socket.on('disconnect', () => {
    void redis.del(RedisKeys.riderLocation(riderId)).catch(() => {});
  });
}
