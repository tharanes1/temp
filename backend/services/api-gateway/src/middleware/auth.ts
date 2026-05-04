/**
 * Custom JWT auth middleware (spec §15 — no Passport). Validates the access
 * token only. Rejects refresh tokens (`type: 'refresh'`) — those go to /auth/refresh.
 */
import { UnauthorizedError } from '@cravix/shared-errors';
import type { NextFunction, Request, Response } from 'express';

import { verifyAccessToken } from '../shared/utils/jwt.js';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; phone: string; role: 'rider' };
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or malformed Authorization header'));
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.sub, phone: decoded.phone, role: 'rider' };
    res.locals.riderId = decoded.sub;
    next();
  } catch (err) {
    next(new UnauthorizedError(err instanceof Error ? err.message : 'Invalid or expired token'));
  }
}
