import type { Response } from 'express';

import type { AuthenticatedRequest } from '../../middleware/auth.js';

import { emergencyService } from './service.js';
import type {
  CreateContactInput,
  SosTriggerInput,
  UpdateContactInput,
  UpdateMedicalInput,
} from './schemas.js';

function riderId(req: AuthenticatedRequest): string {
  if (!req.user) throw new Error('authMiddleware did not run');
  return req.user.id;
}

export const emergencyController = {
  async listContacts(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await emergencyService.listContacts(riderId(req));
    res.json({ success: true, data: dto });
  },

  async createContact(req: AuthenticatedRequest & { body: CreateContactInput }, res: Response): Promise<void> {
    const dto = await emergencyService.createContact(riderId(req), req.body);
    res.status(201).json({ success: true, data: dto });
  },

  async updateContact(
    req: AuthenticatedRequest & { params: { contactId: string }; body: UpdateContactInput },
    res: Response,
  ): Promise<void> {
    const dto = await emergencyService.updateContact(riderId(req), req.params.contactId, req.body);
    res.json({ success: true, data: dto });
  },

  async deleteContact(
    req: AuthenticatedRequest & { params: { contactId: string } },
    res: Response,
  ): Promise<void> {
    const r = await emergencyService.deleteContact(riderId(req), req.params.contactId);
    res.json({ success: true, data: r });
  },

  async getMedical(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await emergencyService.getMedical(riderId(req));
    res.json({ success: true, data: dto });
  },

  async updateMedical(req: AuthenticatedRequest & { body: UpdateMedicalInput }, res: Response): Promise<void> {
    const dto = await emergencyService.updateMedical(riderId(req), req.body);
    res.json({ success: true, data: dto });
  },

  async triggerSos(req: AuthenticatedRequest & { body: SosTriggerInput }, res: Response): Promise<void> {
    const dto = await emergencyService.triggerSos(riderId(req), req.body);
    res.status(201).json({ success: true, data: dto });
  },
};
