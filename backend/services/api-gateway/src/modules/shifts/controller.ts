import type { Response } from 'express';

import type { AuthenticatedRequest } from '../../middleware/auth.js';

import { shiftsService } from './service.js';
import type { ShiftPreferencesInput } from './schemas.js';

function riderId(req: AuthenticatedRequest): string {
  if (!req.user) throw new Error('authMiddleware did not run');
  return req.user.id;
}

export const shiftsController = {
  async getPreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await shiftsService.getPreferences(riderId(req));
    res.json({ success: true, data: dto });
  },
  async setPreferences(req: AuthenticatedRequest & { body: ShiftPreferencesInput }, res: Response): Promise<void> {
    const dto = await shiftsService.setPreferences(riderId(req), req.body);
    res.json({ success: true, data: dto });
  },
  async getSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await shiftsService.getSchedule(riderId(req));
    res.json({ success: true, data: dto });
  },
  async getActive(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await shiftsService.getActive(riderId(req));
    res.json({ success: true, data: dto });
  },
};
