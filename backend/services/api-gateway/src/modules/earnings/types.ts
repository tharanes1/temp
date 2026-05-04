/**
 * Wire-format DTOs for /earnings.  Locked A6 — money is `number` rupees.
 */

export interface EarningsSummaryDto {
  period: 'today' | 'week' | 'month';
  totalEarnings: number;
  totalOrders: number;
  avgPerOrder: number;
  totalDistance: number;
  onlineHours: number;
  goal: { target: number; achieved: number; percentage: number };
}

export interface EarningsChartDto {
  labels: string[];
  values: number[];
}

export interface TransactionDto {
  id: string;
  type: 'delivery_earning' | 'long_distance_bonus' | 'incentive_bonus' | 'deduction' | 'adjustment';
  orderId: string | null;
  amount: number;
  description: string;
  timestamp: string;
  status: 'pending' | 'settled' | 'failed';
}

/**
 * Spec privacy rule — leaderboard returns first name + last initial only.
 * No phone, no email, no full name.
 */
export interface LeaderboardEntryDto {
  rank: number;
  displayName: string; // "Vikram S."
  earnings: number;
  orders: number;
  avatar: string | null;
}

export interface LeaderboardDto {
  myRank: number | null;
  myEarnings: number;
  topRiders: LeaderboardEntryDto[];
}

export interface IncentiveDto {
  id: string;
  title: string;
  description: string;
  reward: number;
  progress: number;
  target: number;
  expiresAt: string;
  status: 'active' | 'completed' | 'expired';
}
