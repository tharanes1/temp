/**
 * Rider routes — `/api/v1/rider/*`. All require Bearer auth.
 */
import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.js';
import { validate } from '../../middleware/request-validator.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import { riderController } from './controller.js';
import { UpdateProfileSchema, UpdateStatusSchema, UpdateVehicleSchema } from './schemas.js';

export const riderRouter: Router = Router();

riderRouter.use(authMiddleware);

riderRouter.get('/profile', asyncHandler(riderController.getProfile));
riderRouter.patch(
  '/profile',
  validate({ body: UpdateProfileSchema }),
  asyncHandler(riderController.patchProfile),
);

riderRouter.get('/status', asyncHandler(riderController.getStatus));
riderRouter.patch(
  '/status',
  validate({ body: UpdateStatusSchema }),
  asyncHandler(riderController.patchStatus),
);

riderRouter.get('/vehicle', asyncHandler(riderController.getVehicle));
riderRouter.patch(
  '/vehicle',
  validate({ body: UpdateVehicleSchema }),
  asyncHandler(riderController.patchVehicle),
);
