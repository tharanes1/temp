/**
 * System-alerts hook.
 *
 * Replaces `INITIAL_NOTIFICATIONS` (the 6-row hardcoded array in AlertsScreen).
 * Polls every 60 s so newly-issued admin alerts surface without app reload.
 */
import { useCallback, useEffect, useState } from 'react';

import { notificationsService, type SystemAlert } from '@/services/api/features/notifications';
import { useSocketEvent } from '@/services/socket/useSocketEvent';

const POLL_INTERVAL_MS = 60_000;

export function useAlerts(city?: string) {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await notificationsService.listAlerts(city);
      setAlerts(list);
    } catch (e: unknown) {
      const msg = (e as { message?: string } | undefined)?.message ?? 'Failed to load alerts';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Realtime — when an admin broadcasts a new alert, the socket emits
  // `emergency:alert` to every connected rider; we trigger an immediate re-pull.
  useSocketEvent(
    'emergency:alert',
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { alerts, loading, error, refresh };
}
