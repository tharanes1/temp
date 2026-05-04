import { Router } from 'express';

import { asyncHandler } from '../shared/utils/async-handler.js';

import { liveness, readiness } from './controller.js';

export const healthRouter: Router = Router();

healthRouter.get('/live', asyncHandler(liveness));
healthRouter.get('/ready', asyncHandler(readiness));
healthRouter.get('/', asyncHandler(liveness)); // back-compat alias
