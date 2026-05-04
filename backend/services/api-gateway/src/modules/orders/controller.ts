/**
 * HTTP layer for the Orders module.
 */
import type { Response } from 'express';

import type { AuthenticatedRequest } from '../../middleware/auth.js';

import { orderService } from './service.js';
import type {
  AdminOfferInput,
  DeliveryProofInput,
  HistoryQuery,
  RejectOrderInput,
  UpdateOrderStatusInput,
} from './schemas.js';

function riderId(req: AuthenticatedRequest): string {
  if (!req.user) throw new Error('authMiddleware did not run');
  return req.user.id;
}

export const orderController = {
  async getActive(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await orderService.getActive(riderId(req));
    res.json({ success: true, data: dto });
  },

  async getHistory(
    req: AuthenticatedRequest & { query: HistoryQuery },
    res: Response,
  ): Promise<void> {
    const result = await orderService.listHistory(riderId(req), req.query);
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

  async accept(req: AuthenticatedRequest & { params: { orderId: string } }, res: Response): Promise<void> {
    const dto = await orderService.accept(req.params.orderId, riderId(req));
    res.json({ success: true, data: dto });
  },

  async reject(
    req: AuthenticatedRequest & { params: { orderId: string }; body: RejectOrderInput },
    res: Response,
  ): Promise<void> {
    await orderService.reject(req.params.orderId, riderId(req), req.body);
    res.json({ success: true });
  },

  async updateStatus(
    req: AuthenticatedRequest & {
      params: { orderId: string };
      body: UpdateOrderStatusInput;
    },
    res: Response,
  ): Promise<void> {
    const dto = await orderService.updateStatus(req.params.orderId, riderId(req), req.body);
    res.json({ success: true, data: dto });
  },

  async submitProof(
    req: AuthenticatedRequest & {
      params: { orderId: string };
      body: DeliveryProofInput;
    },
    res: Response,
  ): Promise<void> {
    const dto = await orderService.submitDeliveryProof(req.params.orderId, riderId(req), req.body);
    res.json({ success: true, data: dto });
  },

  async adminOffer(req: AuthenticatedRequest & { body: AdminOfferInput }, res: Response): Promise<void> {
    const result = await orderService.adminOffer(req.body);
    res.status(201).json({ success: true, data: result });
  },
};
