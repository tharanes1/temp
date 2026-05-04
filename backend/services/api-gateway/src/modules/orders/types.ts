/**
 * Wire-format DTOs for the Orders module.
 * Locked A6 — money fields are `number` rupees with up to 2 decimals.
 */
import type { OrderStatusValue } from './schemas.js';

export interface OrderItemDto {
  name: string;
  qty: number;
  icon: string;
}

export interface ActiveOrderDto {
  id: string;
  status: OrderStatusValue;
  hubName: string;
  hubAddress: string;
  hubCoords: { latitude: number; longitude: number };
  deliveryAddress: string;
  destCoords: { latitude: number; longitude: number };
  specialInstructions: string | null;
  distance: number; // km, decimal
  estimatedTime: string; // "22m"
  baseEarnings: number; // rupees, decimal — locked A6
  longDistanceBonus: number;
  totalEarnings: number;
  items: OrderItemDto[];
  merchantRating: number | null;
  assignedAt: string | null;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  proofImageUrl: string | null;
}

export interface OrderHistoryItemDto {
  id: string;
  status: OrderStatusValue;
  hubName: string;
  deliveryAddress: string;
  distance: number;
  baseEarnings: number;
  longDistanceBonus: number;
  totalEarnings: number;
  deliveredAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

/**
 * Wire-format payload for the `order:new-request` socket event.  Mirrors
 * the rider-app `OrderRequestPayload` exactly so the FE can render
 * `DeliveryRequestScreen` without an extra round-trip to `/orders/active`.
 */
export interface OrderRequestPayload {
  orderId: string;
  expiresIn: number; // 45
  baseEarnings: number;
  longDistanceBonus: number;
  distance: number;
  estimatedTime: string;
  hubName: string;
  hubAddress: string;
  hubCoords: { latitude: number; longitude: number };
  deliveryAddress: string;
  destCoords: { latitude: number; longitude: number };
  items: OrderItemDto[];
  specialInstructions: string;
  merchantRating: number;
}
