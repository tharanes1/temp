/**
 * Subscribes to `cravix:events:rider:status` (published by rider-slice
 * `PATCH /rider/status`) and re-broadcasts to the appropriate Socket.IO
 * rooms — the rider's personal room (so the rider's other tabs see the change)
 * and the admin namespace (so dispatch dashboards stay live).
 */
import { logger } from '@cravix/shared-logger';
import { redisSub } from '@cravix/shared-redis';
import type { Server } from 'socket.io';

import { adminRoom, riderRoom } from '../rooms.js';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../types.js';

const CHANNEL = 'cravix:events:rider:status';

export function startRiderStatusSubscriber(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
): void {
  // ioredis requires a dedicated client for subscribe — `redisSub` is exactly that.
  redisSub.subscribe(CHANNEL, (err) => {
    if (err) logger.error('subscribe rider:status failed', { err: err.message });
    else logger.info('subscribed to', { channel: CHANNEL });
  });

  redisSub.on('message', (channel, raw) => {
    if (channel !== CHANNEL) return;
    try {
      const event = JSON.parse(raw) as { riderId: string; isOnline: boolean; at: number };
      // Notify the rider's own devices (they may have multiple tabs/sessions).
      io.to(riderRoom(event.riderId)).emit('notification:push', {
        title: event.isOnline ? 'You are online' : 'You are offline',
        body: event.isOnline ? 'You will start receiving order requests.' : 'You will not receive new order requests.',
        type: 'duty_status',
        metadata: { isOnline: event.isOnline, at: event.at },
      });
      // Admin/dispatch broadcast — namespace ships in the admin slice; for now
      // we use the same default namespace under a dedicated room so a future
      // admin client can simply `socket.join('admin:duty')`.
      io.to(adminRoom('duty')).emit('notification:push', {
        title: 'Rider duty status',
        body: `${event.riderId} ${event.isOnline ? 'online' : 'offline'}`,
        type: 'admin_duty',
        metadata: event as unknown as Record<string, unknown>,
      });
    } catch (e) {
      logger.warn('rider:status subscriber parse error', { err: (e as Error).message });
    }
  });
}
