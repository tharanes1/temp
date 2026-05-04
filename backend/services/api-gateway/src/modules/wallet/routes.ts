import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.js';
import { withdrawLimiter } from '../../middleware/rate-limiter.js';
import { validate } from '../../middleware/request-validator.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import { walletController } from './controller.js';
import {
  AddBankAccountSchema,
  HistoryQuerySchema,
  ReconcileSchema,
  StatementsQuerySchema,
  WithdrawalSchema,
} from './schemas.js';

export const walletRouter: Router = Router();
walletRouter.use(authMiddleware);

walletRouter.get('/balance', asyncHandler(walletController.getBalance));
walletRouter.get('/history', validate({ query: HistoryQuerySchema }), asyncHandler(walletController.getHistory));
walletRouter.get('/cash-in-hand', asyncHandler(walletController.getCashInHand));
walletRouter.post(
  '/cash-in-hand/reconcile',
  validate({ body: ReconcileSchema }),
  asyncHandler(walletController.reconcileCashInHand),
);

walletRouter.get('/bank-accounts', asyncHandler(walletController.getBankAccounts));
walletRouter.post(
  '/bank-accounts',
  validate({ body: AddBankAccountSchema }),
  asyncHandler(walletController.addBankAccount),
);

walletRouter.post(
  '/withdraw',
  withdrawLimiter,
  validate({ body: WithdrawalSchema }),
  asyncHandler(walletController.withdraw),
);

walletRouter.get('/allowance', asyncHandler(walletController.getAllowance));
walletRouter.get(
  '/statements',
  validate({ query: StatementsQuerySchema }),
  asyncHandler(walletController.getStatements),
);
