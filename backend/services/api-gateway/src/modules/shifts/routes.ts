import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.js';
import { validate } from '../../middleware/request-validator.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import { shiftsController } from './controller.js';
import { ShiftPreferencesSchema } from './schemas.js';

export const shiftsRouter: Router = Router();
shiftsRouter.use(authMiddleware);

shiftsRouter.get('/preferences', asyncHandler(shiftsController.getPreferences));
shiftsRouter.put('/preferences', validate({ body: ShiftPreferencesSchema }), asyncHandler(shiftsController.setPreferences));
shiftsRouter.get('/schedule', asyncHandler(shiftsController.getSchedule));
shiftsRouter.get('/active', asyncHandler(shiftsController.getActive));
