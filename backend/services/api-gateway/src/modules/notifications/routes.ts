import { Router } from 'express';

import { adminAuth } from '../../middleware/admin-auth.js';
import { authMiddleware } from '../../middleware/auth.js';
import { validate } from '../../middleware/request-validator.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import { notificationsController } from './controller.js';
import {
  AdminAlertSchema,
  FcmTokenSchema,
  ListQuerySchema,
  NotificationIdParam,
} from './schemas.js';

// ─── Rider-facing ───────────────────────────────────────────────
export const notificationsRouter: Router = Router();
notificationsRouter.use(authMiddleware);

notificationsRouter.get(
  '/',
  validate({ query: ListQuerySchema }),
  asyncHandler(notificationsController.list),
);
notificationsRouter.patch(
  '/read-all',
  asyncHandler(notificationsController.markAllRead),
);
notificationsRouter.patch(
  '/:notificationId/read',
  validate({ params: NotificationIdParam }),
  asyncHandler(notificationsController.markRead),
);
notificationsRouter.get('/alerts', asyncHandler(notificationsController.listAlerts));
notificationsRouter.post(
  '/fcm-token',
  validate({ body: FcmTokenSchema }),
  asyncHandler(notificationsController.registerFcmToken),
);

// ─── Admin (token-gated, mounted at /api/v1/admin/alerts) ───────
export const adminAlertsRouter: Router = Router();
adminAlertsRouter.use(adminAuth);
adminAlertsRouter.post(
  '/alerts',
  validate({ body: AdminAlertSchema }),
  asyncHandler(notificationsController.adminCreateAlert),
);
