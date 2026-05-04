/**
 * Promise-returning route handler wrapper. Express 5 already supports async
 * handlers natively, but this typed helper keeps the controller signature
 * narrow and makes it explicit which handlers may throw.
 */
import type { NextFunction, Request, Response } from 'express';

type AsyncHandler<TReq extends Request = Request> = (
  req: TReq,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export const asyncHandler =
  <TReq extends Request = Request>(fn: AsyncHandler<TReq>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req as TReq, res, next)).catch(next);
  };
