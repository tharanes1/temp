import type { Request, Response } from 'express';

import type { AuthenticatedRequest } from '../../middleware/auth.js';

import { supportService } from './service.js';
import type { CreateTicketInput, FaqQuery } from './schemas.js';

function riderId(req: AuthenticatedRequest): string {
  if (!req.user) throw new Error('authMiddleware did not run');
  return req.user.id;
}

export const supportController = {
  async listFaqs(req: AuthenticatedRequest & { query: FaqQuery }, res: Response): Promise<void> {
    const dto = await supportService.listFaqs(req.query);
    res.json({ success: true, data: dto });
  },

  async createTicket(req: AuthenticatedRequest & { body: CreateTicketInput }, res: Response): Promise<void> {
    const dto = await supportService.createTicket(riderId(req), req.body);
    res.status(201).json({ success: true, data: dto });
  },

  async getDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await supportService.getDocuments(riderId(req));
    res.json({ success: true, data: dto });
  },

  getPrivacyPolicy(_req: Request, res: Response): void {
    res.json({ success: true, data: { content: supportService.getPrivacyPolicy() } });
  },

  getTermsOfService(_req: Request, res: Response): void {
    res.json({ success: true, data: { content: supportService.getTermsOfService() } });
  },
};
