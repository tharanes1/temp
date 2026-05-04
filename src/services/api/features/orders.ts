/**
 * Orders service — wraps /api/v1/orders/*.
 *
 * Locked decisions reflected in the DTOs:
 *   A6 — money fields are decimal rupees (no paise integers).
 */
import apiClient from '../client';

export const ORDER_ENDPOINTS = {
  ACTIVE: '/api/v1/orders/active',
  HISTORY: '/api/v1/orders/history',
  ACCEPT: (id: string) => `/api/v1/orders/${id}/accept`,
  REJECT: (id: string) => `/api/v1/orders/${id}/reject`,
  STATUS: (id: string) => `/api/v1/orders/${id}/status`,
  PROOF: (id: string) => `/api/v1/orders/${id}/delivery-proof`,
} as const;

export type OrderStatusValue =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'picked_up'
  | 'en_route'
  | 'arrived'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export type RiderDrivenStatus = 'picked_up' | 'en_route' | 'arrived' | 'delivered' | 'failed';

export interface Coords {
  latitude: number;
  longitude: number;
}

export interface OrderItem {
  name: string;
  qty: number;
  icon: string;
}

export interface ActiveOrder {
  id: string;
  status: OrderStatusValue;
  hubName: string;
  hubAddress: string;
  hubCoords: Coords;
  deliveryAddress: string;
  destCoords: Coords;
  specialInstructions: string | null;
  distance: number;
  estimatedTime: string;
  baseEarnings: number;
  longDistanceBonus: number;
  totalEarnings: number;
  items: OrderItem[];
  merchantRating: number | null;
  assignedAt: string | null;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  proofImageUrl: string | null;
}

export interface OrderHistoryItem {
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

export type RejectReason = 'too_far' | 'vehicle_issue' | 'personal' | 'other';

export interface PaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface Envelope<T> {
  success: true;
  data: T;
}
interface Paged<T> {
  success: true;
  data: T[];
  pagination: PaginationDto;
}

export const orderService = {
  async getActive(): Promise<ActiveOrder | null> {
    const { data } = await apiClient.get<Envelope<ActiveOrder | null>>(ORDER_ENDPOINTS.ACTIVE);
    return data.data;
  },

  async getHistory(args: { page?: number; limit?: number; status?: 'delivered' | 'failed' | 'cancelled' | 'all' } = {}): Promise<{ items: OrderHistoryItem[]; pagination: PaginationDto }> {
    const { data } = await apiClient.get<Paged<OrderHistoryItem>>(ORDER_ENDPOINTS.HISTORY, {
      params: { page: args.page ?? 1, limit: args.limit ?? 20, status: args.status ?? 'all' },
    });
    return { items: data.data, pagination: data.pagination };
  },

  async accept(orderId: string): Promise<ActiveOrder> {
    const { data } = await apiClient.post<Envelope<ActiveOrder>>(ORDER_ENDPOINTS.ACCEPT(orderId));
    return data.data;
  },

  async reject(orderId: string, reason: RejectReason, note?: string): Promise<void> {
    await apiClient.post(ORDER_ENDPOINTS.REJECT(orderId), note ? { reason, note } : { reason });
  },

  async setStatus(args: {
    orderId: string;
    status: RiderDrivenStatus;
    failureReason?: string;
    proofImageUrl?: string;
  }): Promise<ActiveOrder> {
    const { orderId, ...body } = args;
    const { data } = await apiClient.patch<Envelope<ActiveOrder>>(ORDER_ENDPOINTS.STATUS(orderId), body);
    return data.data;
  },

  async submitProof(orderId: string, proofImageUrl: string): Promise<ActiveOrder> {
    const { data } = await apiClient.post<Envelope<ActiveOrder>>(ORDER_ENDPOINTS.PROOF(orderId), {
      proofImageUrl,
    });
    return data.data;
  },
};
