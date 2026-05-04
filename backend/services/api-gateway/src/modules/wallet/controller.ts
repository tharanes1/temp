import type { Response } from 'express';

import type { AuthenticatedRequest } from '../../middleware/auth.js';

import { walletService } from './service.js';
import type {
  AddBankAccountInput,
  HistoryQuery,
  ReconcileInput,
  StatementsQuery,
  WithdrawalInput,
} from './schemas.js';

function riderId(req: AuthenticatedRequest): string {
  if (!req.user) throw new Error('authMiddleware did not run');
  return req.user.id;
}

export const walletController = {
  async getBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await walletService.getBalance(riderId(req));
    res.json({ success: true, data: dto });
  },
  async getHistory(req: AuthenticatedRequest & { query: HistoryQuery }, res: Response): Promise<void> {
    const result = await walletService.listHistory(riderId(req), req.query);
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
  async getCashInHand(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await walletService.getCashInHand(riderId(req));
    res.json({ success: true, data: dto });
  },
  async reconcileCashInHand(req: AuthenticatedRequest & { body: ReconcileInput }, res: Response): Promise<void> {
    const dto = await walletService.reconcileCashInHand(riderId(req), req.body);
    res.json({ success: true, data: dto });
  },
  async getBankAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await walletService.listBankAccounts(riderId(req));
    res.json({ success: true, data: dto });
  },
  async addBankAccount(req: AuthenticatedRequest & { body: AddBankAccountInput }, res: Response): Promise<void> {
    const dto = await walletService.addBankAccount(riderId(req), req.body);
    res.status(201).json({ success: true, data: dto });
  },
  async withdraw(req: AuthenticatedRequest & { body: WithdrawalInput }, res: Response): Promise<void> {
    const dto = await walletService.withdraw(riderId(req), req.body);
    res.status(201).json({ success: true, data: dto });
  },
  async getAllowance(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await walletService.getAllowance(riderId(req));
    res.json({ success: true, data: dto });
  },
  async getStatements(req: AuthenticatedRequest & { query: StatementsQuery }, res: Response): Promise<void> {
    const dto = await walletService.listStatements(riderId(req), req.query);
    res.json({ success: true, data: dto });
  },
};
