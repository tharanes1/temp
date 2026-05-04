/**
 * Emergency-channel subscriber.  Fans an SOS event out to the admin/ops
 * dashboard so dispatchers can respond in realtime.
 */
import { logger } from '@cravix/shared-logger';
import { redisSub } from '@cravix/shared-redis';
import type { Server } from 'socket.io';

import { adminRoom } from '../rooms.js';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types.js';

const SOS_CHANNEL = 'cravix:events:emergency:sos';

interface SosEvent {
  sosEventId: string;
  riderId: string;
  type: string;
  latitude: number;
  longitude: number;
  note: string | null;
  createdAt: string;
}

export function startEmergencySubscriber(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
): void {
  redisSub.subscribe(SOS_CHANNEL, (err) => {
    if (err) logger.error('subscribe failed', { channel: SOS_CHANNEL, err: err.message });
    else logger.info('subscribed to', { channel: SOS_CHANNEL });
  });

  redisSub.on('message', (channel, raw) => {
    if (channel !== SOS_CHANNEL) return;
    try {
      const evt = JSON.parse(raw) as SosEvent;
      io.to(adminRoom('emergency')).emit('emergency:alert', {
        type: evt.type,
        message: `SOS from rider ${evt.riderId} at (${evt.latitude.toFixed(4)}, ${evt.longitude.toFixed(4)})`,
      });
    } catch (e) {
      logger.warn('emergency subscriber: parse failed', { err: (e as Error).message });
    }
  });
}
