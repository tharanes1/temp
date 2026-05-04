/**
 * Earnings service.
 *
 *   • /summary       Redis-cached 120s
 *   • /chart         Redis-cached 120s (same key shape)
 *   • /transactions  Paginated; no cache (list churns)
 *   • /leaderboard   Redis-cached 300s.  PRIVACY: first name + last initial only.
 *   • /incentives    No real source yet — returns the seed list shape.
 */
import { cacheAside, RedisKeys } from '@cravix/shared-redis';

import { earningsRepository, type PeriodWindow } from './repository.js';
import type {
  ChartQuery,
  LeaderboardQuery,
  Period,
  SummaryQuery,
  TransactionsQuery,
} from './schemas.js';
import type {
  EarningsChartDto,
  EarningsSummaryDto,
  IncentiveDto,
  LeaderboardDto,
  LeaderboardEntryDto,
  TransactionDto,
} from './types.js';

const SUMMARY_CACHE_TTL = 120;
const LEADERBOARD_CACHE_TTL = 300;

const GOALS: Record<Period, number> = { today: 500, week: 3500, month: 14000 };

// ─── Window helpers ─────────────────────────────────────────────

function now(): Date {
  return new Date();
}

function periodWindow(p: Period): PeriodWindow {
  const end = now();
  const start = new Date(end);
  switch (p) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
  }
  return { start, end };
}

function chartWindow(p: 'week' | 'month'): PeriodWindow {
  return periodWindow(p);
}

// ─── Privacy projection (spec §5.6) ─────────────────────────────

function maskName(name: string | null): string {
  if (!name) return 'Rider';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]![0]}.`;
}

// ─── Public API ─────────────────────────────────────────────────

export const earningsService = {
  async getSummary(riderId: string, query: SummaryQuery): Promise<EarningsSummaryDto> {
    return cacheAside(
      RedisKeys.cacheEarnings(riderId, `summary:${query.period}`),
      SUMMARY_CACHE_TTL,
      async () => {
        const window = periodWindow(query.period);
        const agg = await earningsRepository.aggregate({ riderId, window });
        const target = GOALS[query.period];
        const percentage = target > 0 ? Math.min(100, Number(((agg.total / target) * 100).toFixed(1))) : 0;
        const dto: EarningsSummaryDto = {
          period: query.period,
          totalEarnings: Number(agg.total.toFixed(2)),
          totalOrders: agg.orderCount,
          avgPerOrder: agg.orderCount > 0 ? Number((agg.total / agg.orderCount).toFixed(2)) : 0,
          totalDistance: Number(agg.distanceKm.toFixed(2)),
          // Hours online is sourced from rider:status hash — left at 0 here;
          // a follow-up adds a Redis aggregator key keyed by date.
          onlineHours: 0,
          goal: { target, achieved: Number(agg.total.toFixed(2)), percentage },
        };
        return dto;
      },
    );
  },

  async getChart(riderId: string, query: ChartQuery): Promise<EarningsChartDto> {
    return cacheAside(
      RedisKeys.cacheEarnings(riderId, `chart:${query.period}:${query.groupBy}`),
      SUMMARY_CACHE_TTL,
      async () => {
        const window = chartWindow(query.period);
        if (query.groupBy === 'day') {
          const rows = await earningsRepository.groupByDay({ riderId, window });
          // Build a complete day-by-day axis so blank days show 0.
          const labels: string[] = [];
          const values: number[] = [];
          const days = query.period === 'week' ? 7 : 30;
          for (let i = days - 1; i >= 0; i--) {
            const d = new Date(window.end);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - i);
            labels.push(d.toLocaleDateString('en-IN', { weekday: 'short' }));
            const match = rows.find((r) => sameDay(r.day, d));
            values.push(match ? Number(match.total.toFixed(2)) : 0);
          }
          return { labels, values };
        }
        const rows = await earningsRepository.groupByHour({ riderId, window });
        return {
          labels: rows.map((r) => `${r.hour.getHours().toString().padStart(2, '0')}:00`),
          values: rows.map((r) => Number(r.total.toFixed(2))),
        };
      },
    );
  },

  async listTransactions(
    riderId: string,
    query: TransactionsQuery,
  ): Promise<{ items: TransactionDto[]; total: number; page: number; limit: number }> {
    const { items, total } = await earningsRepository.listTransactions({
      riderId,
      page: query.page,
      limit: query.limit,
      type: query.type,
    });
    return {
      items: items.map((r) => ({
        id: r.id,
        type: r.type.toLowerCase() as TransactionDto['type'],
        orderId: r.orderId,
        amount: Number(r.amount),
        description: r.description,
        timestamp: r.createdAt.toISOString(),
        status: r.status.toLowerCase() as TransactionDto['status'],
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  },

  async getLeaderboard(riderId: string, query: LeaderboardQuery): Promise<LeaderboardDto> {
    return cacheAside(
      RedisKeys.cacheLeaderboard(query.period, query.city),
      LEADERBOARD_CACHE_TTL,
      async () => {
        const window = periodWindow(query.period);
        const { rows, myEarnings, myRank } = await earningsRepository.leaderboard({
          window,
          limit: 25,
          riderId,
        });
        const topRiders: LeaderboardEntryDto[] = rows.map((r, idx) => ({
          rank: idx + 1,
          displayName: maskName(r.name), // privacy rule
          earnings: Number(r.total),
          orders: Number(r.orders),
          avatar: r.profileImage,
        }));
        return { myRank, myEarnings: Number(myEarnings.toFixed(2)), topRiders };
      },
    );
  },

  /**
   * Incentives service — no canonical source yet.  Until the campaign
   * service ships, returns an empty array (frontend falls back to the
   * locale fixture).  The wire shape is finalised so consumers compile
   * cleanly today.
   */
  async listIncentives(_riderId: string): Promise<IncentiveDto[]> {
    return [];
  },
};

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
