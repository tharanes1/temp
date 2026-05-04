/**
 * CORS — only the admin/dashboard origins are allowed (mobile app issues no
 * CORS). Spec §10.
 */
import { Config } from '@cravix/shared-config';
import cors from 'cors';

export const corsMiddleware = cors({
  origin: (origin, cb) => {
    // Mobile clients send no Origin → allow.
    if (!origin) return cb(null, true);
    if (Config.ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed`));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'Retry-After'],
  maxAge: 86400,
});
