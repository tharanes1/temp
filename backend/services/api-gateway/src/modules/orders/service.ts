/**
 * Orders service.
 *
 *   • Atomic 45-second claim:    SET cravix:order:assigned:{orderId} {riderId} NX EX 3600
 *   • Pending offer pool:        cravix:order:pending:{orderId}      45s TTL
 *   • Rejection counters:        cravix:order:rejects:{orderId}      24h TTL
 *
 * Realtime fan-out is via Redis pub/sub (the socket-gateway slice
 * subscribes to these channels and re-emits as Socket.IO events):
 *   • cravix:events:order:offer        — offer presented to a specific rider
 *   • cravix:events:order:status       — status change (admin, customer fan-out)
 *   • cravix:events:order:cancelled    — order revoked
 */
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@cravix/shared-errors';
import { logger } from '@cravix/shared-logger';
import { redis, RedisKeys, prefixKey } from '@cravix/shared-redis';
import type { Order, OrderItem, OrderStatus } from '@prisma/client';

import { isCravixS3Url } from '../../shared/services/s3.js';
import { newId } from '../../shared/utils/uuid.js';

import { orderRepository } from './repository.js';
import {
  canTransition,
  type AdminOfferInput,
  type DeliveryProofInput,
  type HistoryQuery,
  type OrderStatusValue,
  type RejectOrderInput,
  type RiderDrivenStatus,
  type UpdateOrderStatusInput,
} from './schemas.js';
import type {
  ActiveOrderDto,
  OrderHistoryItemDto,
  OrderRequestPayload,
} from './types.js';

const OFFER_TTL_SECONDS = 45; // spec §5.4
const ASSIGNED_LOCK_TTL_SECONDS = 60 * 60; // spec §5.4 example uses 1h

// ─── Mappings ────────────────────────────────────────────────────

const DbToWire: Record<OrderStatus, OrderStatusValue> = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  ACCEPTED: 'accepted',
  PICKED_UP: 'picked_up',
  EN_ROUTE: 'en_route',
  ARRIVED: 'arrived',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};
const WireToDb: Record<OrderStatusValue, OrderStatus> = {
  pending: 'PENDING',
  assigned: 'ASSIGNED',
  accepted: 'ACCEPTED',
  picked_up: 'PICKED_UP',
  en_route: 'EN_ROUTE',
  arrived: 'ARRIVED',
  delivered: 'DELIVERED',
  failed: 'FAILED',
  cancelled: 'CANCELLED',
};

const fmtMinutes = (m: number): string => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

// ─── Projection helpers ─────────────────────────────────────────

function projectActive(o: Order & { items: OrderItem[] }): ActiveOrderDto {
  const base = Number(o.baseEarnings);
  const bonus = Number(o.bonus);
  return {
    id: o.id,
    status: DbToWire[o.status],
    hubName: o.hubName,
    hubAddress: o.hubAddress,
    hubCoords: { latitude: Number(o.hubLatitude), longitude: Number(o.hubLongitude) },
    deliveryAddress: o.deliveryAddress,
    destCoords: { latitude: Number(o.destLatitude), longitude: Number(o.destLongitude) },
    specialInstructions: o.specialInstructions,
    distance: Number(o.distanceKm),
    estimatedTime: fmtMinutes(o.estimatedTimeMin),
    baseEarnings: base,
    longDistanceBonus: bonus,
    totalEarnings: Number((base + bonus).toFixed(2)),
    items: o.items.map((i) => ({ name: i.name, qty: i.qty, icon: i.icon })),
    merchantRating: o.merchantRating !== null ? Number(o.merchantRating) : null,
    assignedAt: o.assignedAt?.toISOString() ?? null,
    acceptedAt: o.acceptedAt?.toISOString() ?? null,
    pickedUpAt: o.pickedUpAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    proofImageUrl: o.proofImageUrl,
  };
}

function projectHistory(o: Order & { items: OrderItem[] }): OrderHistoryItemDto {
  const base = Number(o.baseEarnings);
  const bonus = Number(o.bonus);
  return {
    id: o.id,
    status: DbToWire[o.status],
    hubName: o.hubName,
    deliveryAddress: o.deliveryAddress,
    distance: Number(o.distanceKm),
    baseEarnings: base,
    longDistanceBonus: bonus,
    totalEarnings: Number((base + bonus).toFixed(2)),
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    failureReason: o.failureReason,
    createdAt: o.createdAt.toISOString(),
  };
}

// ─── Pub/sub helper ─────────────────────────────────────────────

async function publishEvent(channel: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await redis.publish(channel, JSON.stringify(payload));
  } catch (e) {
    logger.warn(`order publish ${channel} failed`, { err: (e as Error).message });
  }
}

// ─── Public API ─────────────────────────────────────────────────

export const orderService = {
  async getActive(riderId: string): Promise<ActiveOrderDto | null> {
    const order = await orderRepository.findActiveForRider(riderId);
    return order ? projectActive(order) : null;
  },

  async listHistory(
    riderId: string,
    query: HistoryQuery,
  ): Promise<{ items: OrderHistoryItemDto[]; total: number; page: number; limit: number }> {
    const { items, total } = await orderRepository.listHistory({ riderId, ...query });
    return { items: items.map(projectHistory), total, page: query.page, limit: query.limit };
  },

  /**
   * Atomic 45-second claim.  Spec §5.4:
   *   1. Read the pending pool entry; missing ⇒ ORDER_EXPIRED.
   *   2. SET cravix:order:assigned:{id} {riderId} NX EX 3600  — wins exactly
   *      once across all 8 instances.
   *   3. DB write (status flip + riderId), pub/sub fan-out.
   */
  async accept(orderId: string, riderId: string): Promise<ActiveOrderDto> {
    const pendingKey = RedisKeys.orderPending(orderId);
    const pendingRaw = await redis.get(pendingKey);
    if (!pendingRaw) {
      throw new ConflictError('Order offer expired or already taken', 'ORDER_EXPIRED');
    }

    const won = await redis.set(
      RedisKeys.orderAssigned(orderId),
      riderId,
      'EX',
      ASSIGNED_LOCK_TTL_SECONDS,
      'NX',
    );
    if (won !== 'OK') {
      // Another instance won the race.
      throw new ConflictError('Order already taken by another rider', 'ORDER_TAKEN');
    }

    // Remove from pending pool — even if subsequent steps fail, the offer
    // shouldn't be redirected to a different rider (we already promised this
    // one).  We surface failures to the rider via the standard error envelope.
    await redis.del(pendingKey);

    await orderRepository.accept(orderId, riderId);
    const fresh = await orderRepository.findById(orderId);
    if (!fresh) throw new NotFoundError('Order not found after accept');

    await publishEvent('cravix:events:order:status', {
      orderId,
      riderId,
      status: 'accepted',
      at: Date.now(),
    });

    return projectActive(fresh);
  },

  /**
   * Reject increments a per-order counter (so the dispatcher can pick a new
   * rider) but does NOT change the order's status — the order remains
   * `pending` and may be re-offered.
   */
  async reject(orderId: string, riderId: string, input: RejectOrderInput): Promise<void> {
    const counterKey = prefixKey(`order:rejects:${orderId}`);
    await redis
      .multi()
      .incr(counterKey)
      .expire(counterKey, 24 * 60 * 60)
      .exec();
    // Track rider's individual rejection so they aren't re-offered the same order.
    await redis.set(
      prefixKey(`order:rejects:${orderId}:${riderId}`),
      input.reason,
      'EX',
      24 * 60 * 60,
    );
    await publishEvent('cravix:events:order:rejected', {
      orderId,
      riderId,
      reason: input.reason,
      at: Date.now(),
    });
  },

  /**
   * Status update — strict state-machine validation.  Rider can only drive
   * post-acceptance transitions (PICKED_UP through DELIVERED, plus FAILED).
   * Admin/customer-driven CANCELLED is a separate path.
   */
  async updateStatus(
    orderId: string,
    riderId: string,
    input: UpdateOrderStatusInput,
  ): Promise<ActiveOrderDto> {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    if (order.riderId !== riderId) throw new ForbiddenError('Not your order');

    const nextWire: OrderStatusValue = input.status as RiderDrivenStatus;
    const fromWire = DbToWire[order.status];
    if (!canTransition(fromWire, nextWire)) {
      throw new ValidationError(`Illegal transition ${fromWire} → ${nextWire}`, [
        { field: 'status', message: 'Invalid state transition' },
      ]);
    }

    if (nextWire === 'delivered' && !order.proofImageUrl && !input.proofImageUrl) {
      throw new ValidationError('Delivery proof image is required to mark delivered', [
        { field: 'proofImageUrl', message: 'required' },
      ]);
    }
    if (input.proofImageUrl && !isCravixS3Url(input.proofImageUrl)) {
      throw new ValidationError('Proof URL not in cravix-* bucket', [
        { field: 'proofImageUrl', message: 'Must be an https URL inside the cravix-cdn bucket' },
      ]);
    }

    const next = WireToDb[nextWire] as Exclude<OrderStatus, 'PENDING' | 'ASSIGNED' | 'ACCEPTED' | 'CANCELLED'>;
    await orderRepository.transition({
      id: orderId,
      riderId,
      next: next as 'PICKED_UP' | 'EN_ROUTE' | 'ARRIVED' | 'DELIVERED' | 'FAILED',
      ...(input.failureReason !== undefined ? { failureReason: input.failureReason } : {}),
      ...(input.proofImageUrl !== undefined ? { proofImageUrl: input.proofImageUrl } : {}),
    });

    const fresh = await orderRepository.findById(orderId);
    if (!fresh) throw new NotFoundError('Order vanished after update');

    await publishEvent('cravix:events:order:status', {
      orderId,
      riderId,
      status: nextWire,
      at: Date.now(),
    });

    return projectActive(fresh);
  },

  async submitDeliveryProof(
    orderId: string,
    riderId: string,
    input: DeliveryProofInput,
  ): Promise<ActiveOrderDto> {
    if (!isCravixS3Url(input.proofImageUrl)) {
      throw new ValidationError('Proof URL not in cravix-* bucket');
    }
    const order = await orderRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    if (order.riderId !== riderId) throw new ForbiddenError('Not your order');
    await orderRepository.setProof(orderId, riderId, input.proofImageUrl);
    const fresh = await orderRepository.findById(orderId);
    return projectActive(fresh!);
  },

  /**
   * Admin "offer to a specific rider" — minimal stand-in for the future
   * dispatcher service.  Creates the order in PENDING, writes the pending-pool
   * key with 45 s TTL, immediately assigns to the requested rider, and
   * publishes `order:new-request` so the rider's app pops up the offer.
   */
  async adminOffer(input: AdminOfferInput): Promise<{ orderId: string }> {
    const id = newId();
    await orderRepository.createOffered({
      id,
      hubName: input.hubName,
      hubAddress: input.hubAddress,
      hubLatitude: input.hubCoords.latitude,
      hubLongitude: input.hubCoords.longitude,
      deliveryAddress: input.deliveryAddress,
      destLatitude: input.destCoords.latitude,
      destLongitude: input.destCoords.longitude,
      distanceKm: input.distanceKm,
      estimatedTimeMin: input.estimatedTimeMin,
      baseEarnings: input.baseEarnings,
      bonus: input.bonus,
      ...(input.specialInstructions !== undefined ? { specialInstructions: input.specialInstructions } : {}),
      ...(input.merchantRating !== undefined ? { merchantRating: input.merchantRating } : {}),
      items: input.items,
    });

    const payload: OrderRequestPayload = {
      orderId: id,
      expiresIn: OFFER_TTL_SECONDS,
      baseEarnings: input.baseEarnings,
      longDistanceBonus: input.bonus,
      distance: input.distanceKm,
      estimatedTime: fmtMinutes(input.estimatedTimeMin),
      hubName: input.hubName,
      hubAddress: input.hubAddress,
      hubCoords: input.hubCoords,
      deliveryAddress: input.deliveryAddress,
      destCoords: input.destCoords,
      items: input.items,
      specialInstructions: input.specialInstructions ?? '',
      merchantRating: input.merchantRating ?? 0,
    };

    await redis.set(RedisKeys.orderPending(id), JSON.stringify(payload), 'EX', OFFER_TTL_SECONDS);
    await orderRepository.assignToRider(id, input.riderId);

    await publishEvent('cravix:events:order:offer', { riderId: input.riderId, payload });

    return { orderId: id };
  },
};
