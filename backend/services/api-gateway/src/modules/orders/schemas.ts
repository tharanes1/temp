/**
 * Zod schemas for the Orders module.
 *
 * Locked decisions reflected:
 *   A6 — money is decimal rupees on the wire (no paise integers).
 *
 * State machine (spec §5.4):
 *   PENDING → ASSIGNED → ACCEPTED → PICKED_UP → EN_ROUTE → ARRIVED → DELIVERED
 *                                              ↘ FAILED  (terminal)
 *                                              ↘ CANCELLED (terminal)
 */
import { z } from 'zod';

export const OrderStatusEnum = z.enum([
  'pending',
  'assigned',
  'accepted',
  'picked_up',
  'en_route',
  'arrived',
  'delivered',
  'failed',
  'cancelled',
]);
export type OrderStatusValue = z.infer<typeof OrderStatusEnum>;

// ─── Pagination + listing ───────────────────────────────────────

export const HistoryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(['delivered', 'failed', 'cancelled', 'all']).default('all'),
  })
  .strict();
export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;

// ─── Reject ─────────────────────────────────────────────────────

export const RejectOrderSchema = z
  .object({
    reason: z.enum(['too_far', 'vehicle_issue', 'personal', 'other']),
    note: z.string().trim().max(200).optional(),
  })
  .strict();
export type RejectOrderInput = z.infer<typeof RejectOrderSchema>;

// ─── Status update — only the transitions a rider can drive ─────
// Riders cannot self-assign; the assignment engine writes ASSIGNED → ACCEPTED.
// Riders cannot CANCEL — that's an admin-only verb.

export const RiderDrivenStatusEnum = z.enum([
  'picked_up',
  'en_route',
  'arrived',
  'delivered',
  'failed',
]);
export type RiderDrivenStatus = z.infer<typeof RiderDrivenStatusEnum>;

const S3UrlSchema = z.string().url().max(2048);

export const UpdateOrderStatusSchema = z
  .object({
    status: RiderDrivenStatusEnum,
    timestamp: z.string().datetime().optional(),
    failureReason: z.string().max(200).optional(),
    proofImageUrl: S3UrlSchema.optional(),
  })
  .strict()
  .refine(
    (v) => (v.status === 'failed' ? !!v.failureReason : true),
    { message: 'failureReason is required when status=failed', path: ['failureReason'] },
  );
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;

// ─── Delivery proof ─────────────────────────────────────────────

export const DeliveryProofSchema = z
  .object({
    proofImageUrl: S3UrlSchema,
  })
  .strict();
export type DeliveryProofInput = z.infer<typeof DeliveryProofSchema>;

// ─── Order id path param ────────────────────────────────────────

export const OrderIdParamSchema = z
  .object({
    orderId: z.string().uuid(),
  })
  .strict();

// ─── Admin: offer order to a rider (test driver for the realtime flow) ──

export const AdminOfferSchema = z
  .object({
    riderId: z.string().uuid(),
    hubName: z.string().min(2).max(120),
    hubAddress: z.string().min(2).max(255),
    hubCoords: z.object({ latitude: z.number(), longitude: z.number() }).strict(),
    deliveryAddress: z.string().min(2).max(255),
    destCoords: z.object({ latitude: z.number(), longitude: z.number() }).strict(),
    distanceKm: z.number().nonnegative().multipleOf(0.01),
    estimatedTimeMin: z.number().int().min(1).max(600),
    baseEarnings: z.number().nonnegative().multipleOf(0.01),
    bonus: z.number().nonnegative().multipleOf(0.01).default(0),
    items: z
      .array(
        z
          .object({
            name: z.string().min(1).max(120),
            qty: z.number().int().min(1).max(99),
            icon: z.string().max(40),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    specialInstructions: z.string().max(400).optional(),
    merchantRating: z.number().min(0).max(5).optional(),
  })
  .strict();
export type AdminOfferInput = z.infer<typeof AdminOfferSchema>;

// ─── State-machine transition helper ────────────────────────────

const ALLOWED: Record<OrderStatusValue, ReadonlySet<OrderStatusValue>> = {
  pending: new Set(['assigned', 'cancelled']),
  assigned: new Set(['accepted', 'cancelled']),
  accepted: new Set(['picked_up', 'failed', 'cancelled']),
  picked_up: new Set(['en_route', 'failed']),
  en_route: new Set(['arrived', 'failed']),
  arrived: new Set(['delivered', 'failed']),
  delivered: new Set(),
  failed: new Set(),
  cancelled: new Set(),
};

export function canTransition(from: OrderStatusValue, to: OrderStatusValue): boolean {
  return ALLOWED[from].has(to);
}
