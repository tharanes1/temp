/**
 * `rider:going-online` / `rider:going-offline` event mirrors.  The canonical
 * path for status changes is `PATCH /rider/status` (rider slice) — these
 * socket events let realtime-only clients update without an HTTP round-trip.
 *
 * The handler updates the same Redis hash as the rider service so both sources
 * converge on a single `cravix:rider:status:{id}` key.
 */
import { redis, RedisKeys } from '@cravix/shared-redis';
import type { Socket } from 'socket.io';

import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../types.js';

const STATUS_TTL_SECONDS = 4 * 60 * 60;

export function bindRiderHandlers(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
): void {
  const { riderId } = socket.data;

  socket.on('rider:going-online', async () => {
    const now = Date.now();
    const key = RedisKeys.riderStatus(riderId);
    await redis
      .multi()
      .hset(key, { isOnline: '1', since: String(now), lastSeen: String(now) })
      .expire(key, STATUS_TTL_SECONDS)
      .exec();
    await redis.publish(
      'cravix:events:rider:status',
      JSON.stringify({ riderId, isOnline: true, at: now }),
    );
  });

  socket.on('rider:going-offline', async () => {
    const now = Date.now();
    const key = RedisKeys.riderStatus(riderId);
    await redis
      .multi()
      .hset(key, { isOnline: '0', lastSeen: String(now) })
      .expire(key, STATUS_TTL_SECONDS)
      .del(RedisKeys.riderLocation(riderId))
      .exec();
    await redis.publish(
      'cravix:events:rider:status',
      JSON.stringify({ riderId, isOnline: false, at: now }),
    );
  });
}
