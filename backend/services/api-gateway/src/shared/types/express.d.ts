/**
 * Augments Express types so res.locals carries our request-scoped fields and
 * req.user is typed everywhere it's set.
 */
import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; phone: string; role: 'rider' };
  }

  interface Locals {
    requestId: string;
    riderId?: string;
  }
}
