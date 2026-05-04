import type { Response } from 'express';

import type { AuthenticatedRequest } from '../../middleware/auth.js';

import { locationService } from './service.js';
import type { GeocodeQuery, HeatmapQuery, ZonesQuery } from './schemas.js';

export const locationController = {
  async geocode(req: AuthenticatedRequest & { query: GeocodeQuery }, res: Response): Promise<void> {
    const dto = await locationService.reverseGeocode({ lat: req.query.lat, lng: req.query.lng });
    res.json({ success: true, data: dto });
  },

  async listZones(req: AuthenticatedRequest & { query: ZonesQuery }, res: Response): Promise<void> {
    const dto = await locationService.listOperatingZones({ city: req.query.city });
    res.json({ success: true, data: dto });
  },

  async heatmap(req: AuthenticatedRequest & { query: HeatmapQuery }, res: Response): Promise<void> {
    const dto = await locationService.getHeatmap({
      city: req.query.city,
      ...(req.query.bounds !== undefined ? { bounds: req.query.bounds } : {}),
    });
    res.json({ success: true, data: dto });
  },
};
