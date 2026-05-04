import type { Response } from 'express';

import type { AuthenticatedRequest } from '../../middleware/auth.js';

import { notificationsService } from './service.js';
import type { AdminAlertInput, FcmTokenInput, ListQuery } from './schemas.js';

function riderId(req: AuthenticatedRequest): string {
  if (!req.user) throw new Error('authMiddleware did not run');
  return req.user.id;
}

export const notificationsController = {
  async list(req: AuthenticatedRequest & { query: ListQuery }, res: Response): Promise<void> {
    const result = await notificationsService.list(riderId(req), req.query);
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

  async markRead(
    req: AuthenticatedRequest & { params: { notificationId: string } },
    res: Response,
  ): Promise<void> {
    const r = await notificationsService.markRead(riderId(req), req.params.notificationId);
    res.json({ success: true, data: r });
  },

  async markAllRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    const r = await notificationsService.markAllRead(riderId(req));
    res.json({ success: true, data: r });
  },

  async listAlerts(req: AuthenticatedRequest & { query: { city?: string } }, res: Response): Promise<void> {
    const dto = await notificationsService.listAlerts(req.query.city);
    res.json({ success: true, data: dto });
  },

  async registerFcmToken(req: AuthenticatedRequest & { body: FcmTokenInput }, res: Response): Promise<void> {
    const dto = await notificationsService.registerFcmToken(riderId(req), req.body);
    res.status(201).json({ success: true, data: dto });
  },

  async adminCreateAlert(req: AuthenticatedRequest & { body: AdminAlertInput }, res: Response): Promise<void> {
    const dto = await notificationsService.adminCreateAlert(req.body);
    res.status(201).json({ success: true, data: dto });
  },
};
