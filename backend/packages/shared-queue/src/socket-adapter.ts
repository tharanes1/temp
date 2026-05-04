/**
 * Socket.IO Redis adapter helper — wires the cross-instance pub/sub channel
 * required by spec §2.  Without this, an event emitted on instance #1 never
 * reaches a client connected to instance #8.
 */
import { createAdapter } from '@socket.io/redis-adapter';
import type { ServerOptions } from 'socket.io';

import { redisPub, redisSub } from '@cravix/shared-redis';

export function buildRedisAdapter(): ServerOptions['adapter'] {
  // Both clients must already be connected when the Socket.IO server boots —
  // shared-redis instantiates them eagerly at module load.
  return createAdapter(redisPub, redisSub);
}
