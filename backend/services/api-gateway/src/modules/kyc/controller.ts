/**
 * KYC HTTP layer — thin.
 */
import type { Response } from 'express';

import type { AuthenticatedRequest } from '../../middleware/auth.js';

import { kycService } from './service.js';
import type {
  CategoryInput,
  DocumentsInput,
  DisabledInput,
  PersonalInput,
  PresignQuery,
  StudentInput,
} from './schemas.js';

function riderId(req: AuthenticatedRequest): string {
  if (!req.user) throw new Error('authMiddleware did not run');
  return req.user.id;
}

export const kycController = {
  async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await kycService.getStatus(riderId(req));
    res.json({ success: true, data: dto });
  },

  async setCategory(req: AuthenticatedRequest & { body: CategoryInput }, res: Response): Promise<void> {
    const dto = await kycService.setCategory(riderId(req), req.body);
    res.status(201).json({ success: true, data: dto });
  },

  async setPersonal(req: AuthenticatedRequest & { body: PersonalInput }, res: Response): Promise<void> {
    const dto = await kycService.setPersonal(riderId(req), req.body);
    res.status(201).json({ success: true, data: dto });
  },

  async setDocuments(req: AuthenticatedRequest & { body: DocumentsInput }, res: Response): Promise<void> {
    const dto = await kycService.setDocuments(riderId(req), req.body);
    res.status(201).json({ success: true, data: dto });
  },

  async setStudent(req: AuthenticatedRequest & { body: StudentInput }, res: Response): Promise<void> {
    const dto = await kycService.setStudent(riderId(req), req.body);
    res.status(201).json({ success: true, data: dto });
  },

  async setDisabled(req: AuthenticatedRequest & { body: DisabledInput }, res: Response): Promise<void> {
    const dto = await kycService.setDisabled(riderId(req), req.body);
    res.status(201).json({ success: true, data: dto });
  },

  async getPresignedUpload(
    req: AuthenticatedRequest & { query: PresignQuery },
    res: Response,
  ): Promise<void> {
    const dto = await kycService.getPresignedUpload(riderId(req), req.query);
    res.json({ success: true, data: dto });
  },

  async finalize(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await kycService.finalize(riderId(req));
    res.json({ success: true, data: dto });
  },
};
