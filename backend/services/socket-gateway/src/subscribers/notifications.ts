/**
 * Subscribes to the notifications + alerts pub/sub channels and re-emits them
 * as socket events to the appropriate rider rooms.
 *
 * Channels:
 *   • cravix:events:notification:push  → 'notification:push' to a single rider
 *   • cravix:events:alert:broadcast    → 'emergency:alert' (city-scoped or global)
 */
import { logger } from '@cravix/shared-logger';
import { redisSub } from '@cravix/shared-redis';
import type { Server } from 'socket.io';

import { adminRoom, riderRoom } from '../rooms.js';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types.js';

const PUSH = 'cravix:events:notification:push';
const ALERT = 'cravix:events:alert:broadcast';

interface PushEvent {
  riderId: string;
  title: string;
  body: string;
  type: string;
  metadata?: Record<string, unknown>;
}
interface AlertEvent {
  alert: {
    id: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    body: string;
    expiresAt: string;
    city: string | null;
  };
  targetCity: string | null;
}

export function startNotificationsSubscriber(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
): void {
  for (const ch of [PUSH, ALERT]) {
    redisSub.subscribe(ch, (err) => {
      if (err) logger.error('subscribe failed', { channel: ch, err: err.message });
      else logger.info('subscribed to', { channel: ch });
    });
  }

  redisSub.on('message', (channel, raw) => {
    try {
      switch (channel) {
        case PUSH: {
          const evt = JSON.parse(raw) as PushEvent;
          io.to(riderRoom(evt.riderId)).emit('notification:push', {
            title: evt.title,
            body: evt.body,
            type: evt.type,
            metadata: evt.metadata ?? {},
          });
          return;
        }
        case ALERT: {
          const evt = JSON.parse(raw) as AlertEvent;
          // City-scoped: future work joins `RiderAddress.city` to derive the
          // affected rider rooms.  For now we broadcast to the admin room and
          // an `alerts` room riders can opt into.
          io.to(adminRoom('alerts')).emit('emergency:alert', {
            type: evt.alert.severity,
            message: `${evt.alert.title} — ${evt.alert.body}`,
          });
          // Best-effort fan-out to all currently connected riders.  At 80K
          // sockets this is heavy — the dispatcher slice will replace this
          // with per-rider FCM jobs.
          io.emit('emergency:alert', {
            type: evt.alert.severity,
            message: `${evt.alert.title} — ${evt.alert.body}`,
          });
          return;
        }
        default:
          return;
      }
    } catch (e) {
      logger.warn('notifications subscriber: parse failed', { channel, err: (e as Error).message });
    }
  });
}
