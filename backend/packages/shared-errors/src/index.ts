/**
 * Cravix domain error hierarchy.
 *
 * Every error thrown from a controller/service should be (or inherit from)
 * `AppError`. The global error handler converts non-AppErrors into
 * `INTERNAL_ERROR` and never leaks stack traces over the wire.
 *
 * Codes match BACKEND_REQUIREMENTS.md §12.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'OTP_EXPIRED'
  | 'OTP_INVALID'
  | 'OTP_LOCKED'
  | 'KYC_REQUIRED'
  | 'KYC_REJECTED'
  | 'ORDER_TAKEN'
  | 'ORDER_EXPIRED'
  | 'INSUFFICIENT_BALANCE'
  | 'TOKEN_REUSE_DETECTED'
  | 'INTERNAL_ERROR';

export interface ErrorDetail {
  field: string;
  message: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: ErrorDetail[];
  public override readonly cause?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    options: { details?: ErrorDetail[]; cause?: unknown } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    if (options.details !== undefined) this.details = options.details;
    if (options.cause !== undefined) this.cause = options.cause;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: ErrorDetail[]) {
    super('VALIDATION_ERROR', message, 400, details ? { details } : {});
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super('NOT_FOUND', message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code: ErrorCode = 'CONFLICT') {
    super(code, message, 409);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests', retryAfterSec?: number) {
    super('RATE_LIMITED', message, 429, retryAfterSec ? { details: [{ field: 'retryAfter', message: String(retryAfterSec) }] } : {});
  }
}

export class OtpExpiredError extends AppError {
  constructor() {
    super('OTP_EXPIRED', 'OTP expired or not found', 401);
  }
}

export class OtpInvalidError extends AppError {
  constructor() {
    super('OTP_INVALID', 'Incorrect OTP', 401);
  }
}

export class OtpLockedError extends AppError {
  constructor() {
    super('OTP_LOCKED', 'Too many incorrect attempts. Please try again later.', 429);
  }
}

export class TokenReuseDetectedError extends AppError {
  constructor() {
    super('TOKEN_REUSE_DETECTED', 'Refresh token reuse detected. All sessions revoked.', 401);
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error', cause?: unknown) {
    super('INTERNAL_ERROR', message, 500, cause !== undefined ? { cause } : {});
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
