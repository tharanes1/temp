import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.js';
import { validate } from '../../middleware/request-validator.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import { locationController } from './controller.js';
import { GeocodeQuerySchema, HeatmapQuerySchema, ZonesQuerySchema } from './schemas.js';

export const locationRouter: Router = Router();
locationRouter.use(authMiddleware);

locationRouter.get(
  '/geocode',
  validate({ query: GeocodeQuerySchema }),
  asyncHandler(locationController.geocode),
);
locationRouter.get(
  '/operating-zones',
  validate({ query: ZonesQuerySchema }),
  asyncHandler(locationController.listZones),
);
locationRouter.get(
  '/heatmap',
  validate({ query: HeatmapQuerySchema }),
  asyncHandler(locationController.heatmap),
);
