/**
 * Helmet + HPP. Spec §14.
 */
import type { Express } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';

export function applySecurityHeaders(app: Express): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          // We serve only JSON — disallow everything by default.
          'default-src': ["'none'"],
          'frame-ancestors': ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
    }),
  );
  app.use(hpp());
}
