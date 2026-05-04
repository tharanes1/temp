/**
 * Zod schemas for /api/v1/earnings/*.
 *
 * Locked decisions reflected:
 *   A6 — money is decimal rupees on the wire.  No paise integers.
 */
import { z } from 'zod';

export const PeriodEnum = z.enum(['today', 'week', 'month']);
export type Period = z.infer<typeof PeriodEnum>;

export const SummaryQuerySchema = z
  .object({
    period: PeriodEnum.default('today'),
  })
  .strict();
export type SummaryQuery = z.infer<typeof SummaryQuerySchema>;

export const ChartQuerySchema = z
  .object({
    period: z.enum(['week', 'month']).default('week'),
    groupBy: z.enum(['day', 'hour']).default('day'),
  })
  .strict();
export type ChartQuery = z.infer<typeof ChartQuerySchema>;

export const TransactionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    type: z
      .enum(['delivery_earning', 'long_distance_bonus', 'incentive_bonus', 'deduction', 'adjustment', 'all'])
      .default('all'),
  })
  .strict();
export type TransactionsQuery = z.infer<typeof TransactionsQuerySchema>;

export const LeaderboardQuerySchema = z
  .object({
    period: PeriodEnum.default('today'),
    city: z.string().trim().min(2).max(80).default('bengaluru'),
  })
  .strict();
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;
