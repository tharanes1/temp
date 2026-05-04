/**
 * HTTP layer for the Rider module — thin controller, validation already done.
 */
import type { Response } from 'express';

import type { AuthenticatedRequest } from '../../middleware/auth.js';

import { riderService } from './service.js';
import type {
  UpdateProfileInput,
  UpdateStatusInput,
  UpdateVehicleInput,
} from './schemas.js';

function riderIdOf(req: AuthenticatedRequest): string {
  if (!req.user) throw new Error('authMiddleware did not run');
  return req.user.id;
}

export const riderController = {
  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await riderService.getProfile(riderIdOf(req));
    res.json({ success: true, data: dto });
  },

  async patchProfile(
    req: AuthenticatedRequest & { body: UpdateProfileInput },
    res: Response,
  ): Promise<void> {
    const dto = await riderService.updateProfile(riderIdOf(req), req.body);
    res.json({ success: true, data: dto });
  },

  async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await riderService.getStatus(riderIdOf(req));
    res.json({ success: true, data: dto });
  },

  async patchStatus(
    req: AuthenticatedRequest & { body: UpdateStatusInput },
    res: Response,
  ): Promise<void> {
    const dto = await riderService.updateStatus(riderIdOf(req), req.body);
    res.json({ success: true, data: dto });
  },

  async getVehicle(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = await riderService.getVehicle(riderIdOf(req));
    res.json({ success: true, data: dto });
  },

  async patchVehicle(
    req: AuthenticatedRequest & { body: UpdateVehicleInput },
    res: Response,
  ): Promise<void> {
    const dto = await riderService.updateVehicle(riderIdOf(req), req.body);
    res.json({ success: true, data: dto });
  },
};
