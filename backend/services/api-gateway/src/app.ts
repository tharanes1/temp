/**
 * Express application factory. Builds the middleware chain and mounts all
 * versioned routers. Pure — no side effects (server is started in index.ts).
 */
import { Config } from '@cravix/shared-config';
import compression from 'compression';
import express, { type Express, type Request, type Response } from 'express';

import { authRouter } from './modules/auth/routes.js';
import { earningsRouter } from './modules/earnings/routes.js';
import { emergencyRouter } from './modules/emergency/routes.js';
import { kycRouter } from './modules/kyc/routes.js';
import { locationRouter } from './modules/location/routes.js';
import { adminAlertsRouter, notificationsRouter } from './modules/notifications/routes.js';
import { adminOrderRouter, orderRouter } from './modules/orders/routes.js';
import { riderRouter } from './modules/rider/routes.js';
import { shiftsRouter } from './modules/shifts/routes.js';
import { supportRouter } from './modules/support/routes.js';
import { walletRouter } from './modules/wallet/routes.js';
import { healthRouter } from './health/routes.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { requestLogger } from './middleware/request-logger.js';
import { applySecurityHeaders } from './middleware/security.js';

export function buildApp(): Express {
  const app = express();

  // Trust the configured number of Nginx hops so req.ip reflects the client.
  app.set('trust proxy', Config.TRUSTED_PROXIES);
  app.disable('x-powered-by');
  app.disable('etag'); // Prevents stale 304s on JSON responses

  // ── Pre-routing chain ──────────────────────────────────────────
  app.use(requestId);
  applySecurityHeaders(app);
  app.use(corsMiddleware);
  app.use(compression());
  app.use(express.json({ limit: Config.MAX_BODY_SIZE }));
  app.use(express.urlencoded({ extended: false, limit: Config.MAX_BODY_SIZE }));
  app.use(requestLogger);

  // ── Routes ─────────────────────────────────────────────────────
  app.use('/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/rider', riderRouter);
  app.use('/api/v1/kyc', kycRouter);
  app.use('/api/v1/orders', orderRouter);
  app.use('/api/v1/admin', adminOrderRouter);
  app.use('/api/v1/admin', adminAlertsRouter);
  app.use('/api/v1/earnings', earningsRouter);
  app.use('/api/v1/wallet', walletRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/shifts', shiftsRouter);
  app.use('/api/v1/location', locationRouter);
  app.use('/api/v1/emergency', emergencyRouter);
  app.use('/api/v1/support', supportRouter);

  // ── Root ───────────────────────────────────────────────────────
  app.get('/', (_req: Request, res: Response) => {
    res.json({ success: true, data: { name: 'cravix-api-gateway', version: '0.1.0' } });
  });

  // ── Tail handlers ──────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
