/**
 * Paginated order history.  Replaces OrdersScreen's HISTORY_MOCK array.
 */
import { useCallback, useEffect, useState } from 'react';

import { orderService, type OrderHistoryItem, type PaginationDto } from '@/services/api/features/orders';

export function useOrderHistory(initial = { page: 1, limit: 20 }) {
  const [items, setItems] = useState<OrderHistoryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationDto | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items: rows, pagination: pg } = await orderService.getHistory(initial);
      setItems(rows);
      setPagination(pg);
    } catch (e: unknown) {
      const msg = (e as { message?: string } | undefined)?.message ?? 'Failed to load history';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [initial]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, pagination, loading, error, refresh };
}
