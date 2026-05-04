/**
 * Auth routes — `/api/v1/auth/*`. Zod-validated, rate-limited per spec §14.
 */
import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.js';
import { otpLimiter, refreshLimiter } from '../../middleware/rate-limiter.js';
import { validate } from '../../middleware/request-validator.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import { authController } from './controller.js';
import { LoginSchema, RefreshSchema, VerifyOtpSchema } from './schemas.js';

export const authRouter: Router = Router();

// POST /api/v1/auth/login   — initiate OTP
authRouter.post(
  '/login',
  validate({ body: LoginSchema }),
  otpLimiter,
  asyncHandler(authController.login),
);

// POST /api/v1/auth/verify  — verify OTP, return access + refresh
authRouter.post(
  '/verify',
  validate({ body: VerifyOtpSchema }),
  otpLimiter, // verify failures also count toward the 5/10min cap
  asyncHandler(authController.verify),
);

// POST /api/v1/auth/refresh — rotate tokens
authRouter.post(
  '/refresh',
  validate({ body: RefreshSchema }),
  refreshLimiter,
  asyncHandler(authController.refresh),
);

// POST /api/v1/auth/logout  — revoke refresh
authRouter.post(
  '/logout',
  authMiddleware,
  asyncHandler(authController.logout),
);
