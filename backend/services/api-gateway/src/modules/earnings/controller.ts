import type { Response } from 'express';

import type { AuthenticatedRequest } from '../../middleware/auth.js';

import { earningsService } from './service.js';
import type { ChartQuery, LeaderboardQuery, SummaryQuery, TransactionsQuery } from './schemas.js';

function riderId(req: AuthenticatedRequest): string {
  if (!req.user) throw new Error('authMiddleware did not run');
  return req.user.id;
}

export const earningsController = {
  async getSummary(req: AuthenticatedRequest & { query: SummaryQuery }, res: Response): Promise<void> {
    const dto = await earningsService.getSummary(riderId(req), req.query);
    res.json({ success: true, data: dto });
  },
  async getChart(req: AuthenticatedRequest & { query: ChartQuery }, res: Response): Promise<void> {
    const dto = await earningsService.getChart(riderId(req), req.query);
    res.json({ success: true, data: dto });
  },
  async listTransactions(req: AuthenticatedRequest & { query: TransactionsQuery }, res: Response): Promise<void> {
    const result = await earningsService.listTransactions(riderId(req), req.query);
    res.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
        hasNext: result.page * result.limit < result.total,
        hasPrev: result.page > 1,
      },
    });
  },
  async getLeaderboard(req: AuthenticatedRequest & { query: LeaderboardQuery }, res: Response): Promise<void> {
    const dto = await earningsService.getLeaderboard(riderId(req), req.query);
    res.json({ success: true, data: dto });
  },
  async getIncentives(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await earningsService.listIncentives(riderId(req));
    res.json({ success: true, data: dto });
  },
};
