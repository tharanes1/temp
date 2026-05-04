/**
 * Notifications inbox hook.
 *
 * Replaces the hardcoded `NOTIFICATIONS_DATA` 8-row array in NotificationsScreen.
 * Refetches when the rider taps the screen (focus-driven via the caller's
 * `useFocusEffect`) and on `notification:push` socket events.
 */
import { useCallback, useEffect, useState } from 'react';

import { notificationsService, type NotificationItem } from '@/services/api/features/notifications';
import { useSocketEvent } from '@/services/socket/useSocketEvent';

interface UseNotificationsResult {
  items: NotificationItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  unreadCount: number;
}

export function useNotifications(args: { unreadOnly?: boolean; limit?: number } = {}): UseNotificationsResult {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await notificationsService.list({
        page: 1,
        limit: args.limit ?? 30,
        unreadOnly: args.unreadOnly ?? false,
      });
      setItems(data);
    } catch (e: unknown) {
      const msg = (e as { message?: string } | undefined)?.message ?? 'Failed to load notifications';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [args.unreadOnly, args.limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime — every push from the backend triggers a re-pull so the inbox
  // stays in sync without us having to reconstruct the row from the event.
  useSocketEvent(
    'notification:push',
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic update — flip `isRead` locally, fall back if the server fails.
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      try {
        await notificationsService.markRead(id);
      } catch (e) {
        if (__DEV__) console.warn('markRead failed:', (e as Error).message);
        void refresh();
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    const snapshot = items;
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await notificationsService.markAllRead();
    } catch (e) {
      if (__DEV__) console.warn('markAllRead failed:', (e as Error).message);
      setItems(snapshot);
    }
  }, [items]);

  const unreadCount = items.filter((n) => !n.isRead).length;

  return { items, loading, error, refresh, markRead, markAllRead, unreadCount };
}
