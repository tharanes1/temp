/**
 * Header-based admin auth — minimal stand-in until the dashboard slice ships.
 * Required for the test "offer order to a specific rider" endpoint and any
 * other admin-driven order-flow utilities.
 */
import { timingSafeEqual } from 'node:crypto';

import { Config } from '@cravix/shared-config';
import { ForbiddenError } from '@cravix/shared-errors';
import type { NextFunction, Request, Response } from 'express';

export function adminAuth(req: Request, _res: Response, next: NextFunction): void {
  const expected = Config.ADMIN_API_TOKEN;
  if (!expected) {
    return next(new ForbiddenError('Admin API not configured (ADMIN_API_TOKEN)'));
  }
  const provided = req.header('x-admin-token') ?? '';
  const a = Buffer.from(expected);
  const b = Buffer.from(provided.padEnd(expected.length, '\0').slice(0, expected.length));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return next(new ForbiddenError('Invalid admin token'));
  }
  next();
}
