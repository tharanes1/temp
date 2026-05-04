/**
 * Subscribes to the order-pub channels populated by the API gateway and
 * re-emits as Socket.IO events to the appropriate rider room.
 *
 * Channels:
 *   • cravix:events:order:offer       → 'order:new-request' (1 specific rider)
 *   • cravix:events:order:status      → 'order:status-updated' (assigned rider)
 *   • cravix:events:order:cancelled   → 'order:cancelled' (assigned rider)
 *   • cravix:events:order:rejected    → admin namespace (placeholder)
 */
import { logger } from '@cravix/shared-logger';
import { redisSub } from '@cravix/shared-redis';
import type { Server } from 'socket.io';

import { adminRoom, riderRoom } from '../rooms.js';
import type {
  ClientToServerEvents,
  InterServerEvents,
  OrderRequestPayload,
  ServerToClientEvents,
  SocketData,
} from '../types.js';

const OFFER_CHANNEL = 'cravix:events:order:offer';
const STATUS_CHANNEL = 'cravix:events:order:status';
const CANCELLED_CHANNEL = 'cravix:events:order:cancelled';
const REJECTED_CHANNEL = 'cravix:events:order:rejected';

interface OfferEvent {
  riderId: string;
  payload: OrderRequestPayload;
}
interface StatusEvent {
  orderId: string;
  riderId: string;
  status: string;
  at: number;
}
interface CancelledEvent {
  orderId: string;
  riderId?: string;
  reason: string;
}
interface RejectedEvent {
  orderId: string;
  riderId: string;
  reason: string;
  at: number;
}

export function startOrderEventsSubscriber(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
): void {
  for (const ch of [OFFER_CHANNEL, STATUS_CHANNEL, CANCELLED_CHANNEL, REJECTED_CHANNEL]) {
    redisSub.subscribe(ch, (err) => {
      if (err) logger.error('subscribe failed', { channel: ch, err: err.message });
      else logger.info('subscribed to', { channel: ch });
    });
  }

  redisSub.on('message', (channel, raw) => {
    try {
      switch (channel) {
        case OFFER_CHANNEL: {
          const evt = JSON.parse(raw) as OfferEvent;
          io.to(riderRoom(evt.riderId)).emit('order:new-request', evt.payload);
          return;
        }
        case STATUS_CHANNEL: {
          const evt = JSON.parse(raw) as StatusEvent;
          io.to(riderRoom(evt.riderId)).emit('order:status-updated', {
            orderId: evt.orderId,
            status: evt.status,
            at: evt.at,
          });
          io.to(adminRoom('orders')).emit('order:status-updated', {
            orderId: evt.orderId,
            status: evt.status,
            at: evt.at,
          });
          return;
        }
        case CANCELLED_CHANNEL: {
          const evt = JSON.parse(raw) as CancelledEvent;
          if (evt.riderId) {
            io.to(riderRoom(evt.riderId)).emit('order:cancelled', {
              orderId: evt.orderId,
              reason: evt.reason,
            });
          }
          io.to(adminRoom('orders')).emit('order:cancelled', {
            orderId: evt.orderId,
            reason: evt.reason,
          });
          return;
        }
        case REJECTED_CHANNEL: {
          const evt = JSON.parse(raw) as RejectedEvent;
          // Tell the dispatch dashboard so it can re-offer to the next rider.
          io.to(adminRoom('orders')).emit('notification:push', {
            title: 'Order rejected',
            body: `Rider ${evt.riderId} rejected ${evt.orderId} (${evt.reason})`,
            type: 'admin_order_rejected',
            metadata: evt as unknown as Record<string, unknown>,
          });
          return;
        }
        default:
          return;
      }
    } catch (e) {
      logger.warn('order subscriber: parse failed', { channel, err: (e as Error).message });
    }
  });
}
