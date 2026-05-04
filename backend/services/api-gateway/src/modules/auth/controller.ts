/**
 * HTTP layer — thin. Validation has already passed (req.body is typed by Zod
 * schemas via the `validate` middleware). All business logic is in `authService`.
 */
import type { Request, Response } from 'express';

import type { AuthenticatedRequest } from '../../middleware/auth.js';

import { authService } from './service.js';
import type { LoginInput, RefreshInput, VerifyOtpInput } from './schemas.js';

const ipOf = (req: Request) => req.ip ?? null;
const uaOf = (req: Request) => req.header('user-agent') ?? null;

export const authController = {
  async login(req: Request<unknown, unknown, LoginInput>, res: Response): Promise<void> {
    const { phone } = req.body;
    const result = await authService.initiateLogin(phone, ipOf(req), uaOf(req));
    res.status(201).json({
      success: true,
      message: 'OTP sent successfully',
      data: result,
    });
  },

  async verify(req: Request<unknown, unknown, VerifyOtpInput>, res: Response): Promise<void> {
    const { phone, otp, consentVersion } = req.body;
    const result = await authService.verifyOtp({
      phone,
      otp,
      ...(consentVersion !== undefined ? { consentVersion } : {}),
      ip: ipOf(req),
      userAgent: uaOf(req),
    });
    res.status(200).json({ success: true, data: result });
  },

  async refresh(req: Request<unknown, unknown, RefreshInput>, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken, ipOf(req), uaOf(req));
    res.status(200).json({ success: true, data: result });
  },

  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      // authMiddleware should have already rejected — defensive.
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        requestId: res.locals.requestId,
      });
      return;
    }
    await authService.logout(req.user.id, ipOf(req), uaOf(req));
    res.status(200).json({ success: true });
  },
};
