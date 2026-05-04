import { Router } from 'express';

import { adminAuth } from '../../middleware/admin-auth.js';
import { authMiddleware } from '../../middleware/auth.js';
import { validate } from '../../middleware/request-validator.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import { orderController } from './controller.js';
import {
  AdminOfferSchema,
  DeliveryProofSchema,
  HistoryQuerySchema,
  OrderIdParamSchema,
  RejectOrderSchema,
  UpdateOrderStatusSchema,
} from './schemas.js';

// ─── Rider-facing routes ────────────────────────────────────────
export const orderRouter: Router = Router();
orderRouter.use(authMiddleware);

orderRouter.get('/active', asyncHandler(orderController.getActive));
orderRouter.get(
  '/history',
  validate({ query: HistoryQuerySchema }),
  asyncHandler(orderController.getHistory),
);

orderRouter.post(
  '/:orderId/accept',
  validate({ params: OrderIdParamSchema }),
  asyncHandler(orderController.accept),
);
orderRouter.post(
  '/:orderId/reject',
  validate({ params: OrderIdParamSchema, body: RejectOrderSchema }),
  asyncHandler(orderController.reject),
);
orderRouter.patch(
  '/:orderId/status',
  validate({ params: OrderIdParamSchema, body: UpdateOrderStatusSchema }),
  asyncHandler(orderController.updateStatus),
);
orderRouter.post(
  '/:orderId/delivery-proof',
  validate({ params: OrderIdParamSchema, body: DeliveryProofSchema }),
  asyncHandler(orderController.submitProof),
);

// ─── Admin offer (test driver) ──────────────────────────────────
export const adminOrderRouter: Router = Router();
adminOrderRouter.use(adminAuth);

adminOrderRouter.post(
  '/orders/offer',
  validate({ body: AdminOfferSchema }),
  asyncHandler(orderController.adminOffer),
);
