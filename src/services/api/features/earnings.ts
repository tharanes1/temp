/**
 * Earnings service — wraps /api/v1/earnings/*.
 * Locked A6 — money is `number` rupees (no paise integers).
 */
import apiClient from '../client';

export const EARNINGS_ENDPOINTS = {
  SUMMARY: '/api/v1/earnings/summary',
  CHART: '/api/v1/earnings/chart',
  TRANSACTIONS: '/api/v1/earnings/transactions',
  LEADERBOARD: '/api/v1/earnings/leaderboard',
  INCENTIVES: '/api/v1/earnings/incentives',
} as const;

export type Period = 'today' | 'week' | 'month';

export interface EarningsSummary {
  period: Period;
  totalEarnings: number;
  totalOrders: number;
  avgPerOrder: number;
  totalDistance: number;
  onlineHours: number;
  goal: { target: number; achieved: number; percentage: number };
}

export interface EarningsChart {
  labels: string[];
  values: number[];
}

export interface EarningsTransaction {
  id: string;
  type:
    | 'delivery_earning'
    | 'long_distance_bonus'
    | 'incentive_bonus'
    | 'deduction'
    | 'adjustment';
  orderId: string | null;
  amount: number;
  description: string;
  timestamp: string;
  status: 'pending' | 'settled' | 'failed';
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  earnings: number;
  orders: number;
  avatar: string | null;
}

export interface Leaderboard {
  myRank: number | null;
  myEarnings: number;
  topRiders: LeaderboardEntry[];
}

export interface Incentive {
  id: string;
  title: string;
  description: string;
  reward: number;
  progress: number;
  target: number;
  expiresAt: string;
  status: 'active' | 'completed' | 'expired';
}

interface Envelope<T> {
  success: true;
  data: T;
}
interface Paged<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const earningsService = {
  async getSummary(period: Period = 'today'): Promise<EarningsSummary> {
    const { data } = await apiClient.get<Envelope<EarningsSummary>>(EARNINGS_ENDPOINTS.SUMMARY, { params: { period } });
    return data.data;
  },
  async getChart(period: 'week' | 'month' = 'week', groupBy: 'day' | 'hour' = 'day'): Promise<EarningsChart> {
    const { data } = await apiClient.get<Envelope<EarningsChart>>(EARNINGS_ENDPOINTS.CHART, { params: { period, groupBy } });
    return data.data;
  },
  async getTransactions(args: { page?: number; limit?: number; type?: EarningsTransaction['type'] | 'all' } = {}): Promise<Paged<EarningsTransaction>> {
    const { data } = await apiClient.get<Paged<EarningsTransaction>>(EARNINGS_ENDPOINTS.TRANSACTIONS, {
      params: { page: args.page ?? 1, limit: args.limit ?? 20, type: args.type ?? 'all' },
    });
    return data;
  },
  async getLeaderboard(period: Period = 'today', city = 'bengaluru'): Promise<Leaderboard> {
    const { data } = await apiClient.get<Envelope<Leaderboard>>(EARNINGS_ENDPOINTS.LEADERBOARD, { params: { period, city } });
    return data.data;
  },
  async getIncentives(): Promise<Incentive[]> {
    const { data } = await apiClient.get<Envelope<Incentive[]>>(EARNINGS_ENDPOINTS.INCENTIVES);
    return data.data;
  },
};
