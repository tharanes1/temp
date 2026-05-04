/**
 * Zod-only validation middleware. The single validation layer per spec §15.
 *
 *   router.post(
 *     '/login',
 *     validate({ body: LoginSchema }),
 *     loginController,
 *   );
 */
import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(options: ValidateOptions) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (options.body) req.body = options.body.parse(req.body);
      if (options.query) {
        // Express 5 makes req.query a getter — we can still mutate locals
        const parsed = options.query.parse(req.query);
        Object.assign(req.query as Record<string, unknown>, parsed);
      }
      if (options.params) req.params = options.params.parse(req.params) as Request['params'];
      next();
    } catch (err) {
      next(err);
    }
  };
}
