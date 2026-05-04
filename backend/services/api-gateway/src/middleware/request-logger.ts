/**
 * Per-request structured logger. Logs method/path/status/durationMs at end.
 * Skips /health to avoid log noise.
 */
import { logger } from '@cravix/shared-logger';
import type { NextFunction, Request, Response } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith('/health')) return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.info('http', {
      requestId: res.locals.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
      ua: req.header('user-agent'),
      riderId: res.locals.riderId,
    });
  });
  next();
}
