/**
 * Leaderboard hook — privacy rule (first name + last initial only) is
 * enforced server-side so we just render `displayName` directly.
 */
import { useCallback, useEffect, useState } from 'react';

import { earningsService, type Leaderboard, type Period } from '@/services/api/features/earnings';

export function useLeaderboard(initial: { period?: Period; city?: string } = {}) {
  const [data, setData] = useState<Leaderboard | null>(null);
  const [period, setPeriod] = useState<Period>(initial.period ?? 'today');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await earningsService.getLeaderboard(period, initial.city ?? 'bengaluru');
      setData(r);
    } catch (e: unknown) {
      setError((e as { message?: string } | undefined)?.message ?? 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [period, initial.city]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh, period, setPeriod };
}
