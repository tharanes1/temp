/**
 * Earnings dashboard hook — feeds EarningsScreen, EarningsHeader, StatsGrid,
 * RevenueChart, and TransactionsList.
 *
 * Replaces `useEarningsData` (which returned hardcoded `WEEKLY_DATA` and
 * `RECENT_ACTIVITY` plus a `Math.random()` cosmetic wiggle).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  earningsService,
  type EarningsChart,
  type EarningsSummary,
  type EarningsTransaction,
  type Period,
} from '@/services/api/features/earnings';

export interface ChartBar {
  label: string;
  value: number;
  /** Server doesn't track which day is "today" — we mark the rightmost bar. */
  active: boolean;
}

export interface ActivityItem {
  id: string;
  type: EarningsTransaction['type'];
  title: string;
  subtitle: string;
  amount: string;
  amountSign: '+' | '-';
  status: 'settled' | 'pending' | 'failed';
  statusColor: '#10B981' | '#F59E0B' | '#EF4444';
}

interface UseEarningsResult {
  summary: EarningsSummary | null;
  chart: ChartBar[];
  activities: ActivityItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setPeriod: (p: Period) => void;
  period: Period;
}

const STATUS_COLOR: Record<ActivityItem['status'], ActivityItem['statusColor']> = {
  settled: '#10B981',
  pending: '#F59E0B',
  failed: '#EF4444',
};

export function useEarnings(initialPeriod: Period = 'today'): UseEarningsResult {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [chartRaw, setChartRaw] = useState<EarningsChart | null>(null);
  const [txns, setTxns] = useState<EarningsTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const chartPeriod = period === 'today' ? 'week' : period;
      const [s, c, t] = await Promise.all([
        earningsService.getSummary(period),
        earningsService.getChart(chartPeriod, 'day'),
        earningsService.getTransactions({ page: 1, limit: 10, type: 'all' }),
      ]);
      setSummary(s);
      setChartRaw(c);
      setTxns(t.data);
    } catch (e: unknown) {
      const msg = (e as { message?: string } | undefined)?.message ?? 'Failed to load earnings';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const chart = useMemo<ChartBar[]>(() => {
    if (!chartRaw) return [];
    const lastIdx = chartRaw.labels.length - 1;
    return chartRaw.labels.map((label, i) => ({
      label,
      value: chartRaw.values[i] ?? 0,
      active: i === lastIdx,
    }));
  }, [chartRaw]);

  const activities = useMemo<ActivityItem[]>(() => {
    return txns.map((t) => {
      const positive = t.amount >= 0;
      return {
        id: t.id,
        type: t.type,
        title: t.description,
        subtitle: new Date(t.timestamp).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
        amount: `₹${Math.abs(t.amount).toFixed(2)}`,
        amountSign: positive ? '+' : '-',
        status: t.status,
        statusColor: STATUS_COLOR[t.status],
      };
    });
  }, [txns]);

  return { summary, chart, activities, loading, error, refresh, setPeriod, period };
}
