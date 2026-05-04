/**
 * Global error handler + 404. Converts errors into the spec §11 envelope.
 */
import { AppError, isAppError } from '@cravix/shared-errors';
import { logger } from '@cravix/shared-logger';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    requestId: res.locals.requestId,
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ── Zod validation
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.') || '<root>', message: i.message }));
    logger.warn('validation_error', { requestId: res.locals.requestId, details });
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details },
      requestId: res.locals.requestId,
    });
    return;
  }

  // ── Domain error
  if (isAppError(err)) {
    if (err.status >= 500) {
      logger.error('app_error', { requestId: res.locals.requestId, code: err.code, msg: err.message });
    } else {
      logger.warn('app_error', { requestId: res.locals.requestId, code: err.code, msg: err.message });
    }
    res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
      requestId: res.locals.requestId,
    });
    return;
  }

  // ── Unknown — never leak details
  const e = err as Error;
  logger.error('unhandled_error', {
    requestId: res.locals.requestId,
    err: e?.message,
    stack: e?.stack,
  });
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    requestId: res.locals.requestId,
  });
}

/** Re-export so route files can convert thrown vs returned errors uniformly. */
export { AppError };
