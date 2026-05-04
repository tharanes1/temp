/**
 * Generates / propagates X-Request-ID. Required by spec §14 for cross-instance
 * traceability. Uses caller-supplied id when present; falls back to UUIDv7.
 */
import type { NextFunction, Request, Response } from 'express';
import { v7 as uuidv7 } from 'uuid';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id = incoming && /^[a-zA-Z0-9_\-:]{6,80}$/.test(incoming) ? incoming : `req_${uuidv7()}`;
  res.locals.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}
