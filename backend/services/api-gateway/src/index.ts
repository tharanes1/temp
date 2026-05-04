/**
 * API gateway entrypoint. One process per container, 8 instances behind Nginx.
 * Spec §1 — port 3000 for HTTP, separate socket-gateway service handles WSS on 5000.
 */
import { Config } from '@cravix/shared-config';
import { logger } from '@cravix/shared-logger';
import { disconnectAll } from '@cravix/shared-redis';

import { buildApp } from './app.js';
import { prisma } from './config/database.js';

async function bootstrap(): Promise<void> {
  const app = buildApp();
  const server = app.listen(Config.PORT, Config.HOST, () => {
    logger.info(`api-gateway listening on http://${Config.HOST}:${Config.PORT}`, {
      instance: Config.INSTANCE_ID,
      env: Config.NODE_ENV,
    });
  });

  // Graceful shutdown — finish in-flight requests, drain DB+Redis, then exit.
  const shutdown = async (signal: string) => {
    logger.warn(`Received ${signal}, draining...`);
    server.close(async (err) => {
      if (err) logger.error('http server close error', { err: err.message });
      try {
        await prisma.$disconnect();
        await disconnectAll();
      } catch (e) {
        logger.error('drain failed', { err: (e as Error).message });
      }
      process.exit(err ? 1 : 0);
    });
    // Hard timeout
    setTimeout(() => {
      logger.error('Shutdown timeout — forcing exit');
      process.exit(1);
    }, 15_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection', { reason: String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException', { err: err.message, stack: err.stack });
    void shutdown('uncaughtException');
  });
}

bootstrap().catch((err) => {
  logger.error('bootstrap failed', { err: (err as Error).message });
  process.exit(1);
});
