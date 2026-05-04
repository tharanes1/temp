/**
 * Active-order hook — single source of truth for OrdersScreen and
 * ActiveNavigationScreen.  Polls on mount; re-syncs on `order:status-updated`
 * from the socket.
 */
import { useCallback, useEffect, useState } from 'react';

import { orderService, type ActiveOrder, type RiderDrivenStatus } from '@/services/api/features/orders';
import { useSocketEvent } from '@/services/socket/useSocketEvent';

interface UseActiveOrderResult {
  order: ActiveOrder | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setStatus: (next: RiderDrivenStatus, opts?: { failureReason?: string; proofImageUrl?: string }) => Promise<ActiveOrder | null>;
  submitProof: (url: string) => Promise<ActiveOrder | null>;
}

export function useActiveOrder(): UseActiveOrderResult {
  const [order, setOrder] = useState<ActiveOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await orderService.getActive();
      setOrder(next);
    } catch (e: unknown) {
      const msg = (e as { message?: string } | undefined)?.message ?? 'Failed to load active order';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Server-driven status pings — re-pull the order so the FE never drifts.
  useSocketEvent('order:status-updated', useCallback(() => { void refresh(); }, [refresh]));
  useSocketEvent('order:cancelled', useCallback(() => { void refresh(); }, [refresh]));

  const setStatus = useCallback(
    async (next: RiderDrivenStatus, opts?: { failureReason?: string; proofImageUrl?: string }) => {
      if (!order) return null;
      const updated = await orderService.setStatus({ orderId: order.id, status: next, ...(opts ?? {}) });
      setOrder(updated);
      return updated;
    },
    [order],
  );

  const submitProof = useCallback(
    async (url: string) => {
      if (!order) return null;
      const updated = await orderService.submitProof(order.id, url);
      setOrder(updated);
      return updated;
    },
    [order],
  );

  return { order, loading, error, refresh, setStatus, submitProof };
}
