import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.js';
import { validate } from '../../middleware/request-validator.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import { earningsController } from './controller.js';
import {
  ChartQuerySchema,
  LeaderboardQuerySchema,
  SummaryQuerySchema,
  TransactionsQuerySchema,
} from './schemas.js';

export const earningsRouter: Router = Router();
earningsRouter.use(authMiddleware);

earningsRouter.get('/summary', validate({ query: SummaryQuerySchema }), asyncHandler(earningsController.getSummary));
earningsRouter.get('/chart', validate({ query: ChartQuerySchema }), asyncHandler(earningsController.getChart));
earningsRouter.get('/transactions', validate({ query: TransactionsQuerySchema }), asyncHandler(earningsController.listTransactions));
earningsRouter.get('/leaderboard', validate({ query: LeaderboardQuerySchema }), asyncHandler(earningsController.getLeaderboard));
earningsRouter.get('/incentives', asyncHandler(earningsController.getIncentives));
