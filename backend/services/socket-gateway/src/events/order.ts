/**
 * Order lifecycle confirmations from the rider's app — at-hub and delivered.
 *
 * The full order state machine lives in the API gateway (Orders slice).  This
 * file only buffers the confirmations into Redis so the Orders service can
 * reconcile them against the canonical PATCH /orders/:id/status.
 */
import { redis, prefixKey } from '@cravix/shared-redis';
import type { Socket } from 'socket.io';

import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../types.js';

const ORDER_EVENT_TTL = 600; // 10 min — long enough for the Orders worker to consume

export function bindOrderHandlers(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
): void {
  const { riderId } = socket.data;

  socket.on('order:arrived-at-hub', async (payload) => {
    if (!payload?.orderId) return;
    const key = prefixKey(`order:event:arrived:${payload.orderId}`);
    await redis.set(
      key,
      JSON.stringify({ riderId, at: Date.now() }),
      'EX',
      ORDER_EVENT_TTL,
    );
  });

  socket.on('order:delivery-confirmed', async (payload) => {
    if (!payload?.orderId) return;
    const key = prefixKey(`order:event:delivered:${payload.orderId}`);
    await redis.set(
      key,
      JSON.stringify({ riderId, proofUrl: payload.proofUrl ?? null, at: Date.now() }),
      'EX',
      ORDER_EVENT_TTL,
    );
  });
}
