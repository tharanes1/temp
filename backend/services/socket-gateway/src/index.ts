/**
 * Socket gateway entrypoint. One process per container; 8 instances behind
 * the same Nginx upstream as the API gateway, but on the WS-upgrade path.
 */
import { Config } from '@cravix/shared-config';
import { logger } from '@cravix/shared-logger';
import { closeQueues } from '@cravix/shared-queue';
import { disconnectAll } from '@cravix/shared-redis';

import { startSocketServer } from './server.js';

async function bootstrap(): Promise<void> {
  const { httpServer } = await startSocketServer();

  const shutdown = async (signal: string) => {
    logger.warn(`socket-gateway: received ${signal}, draining...`);
    httpServer.close(async (err) => {
      if (err) logger.error('socket http close error', { err: err.message });
      try {
        await closeQueues();
        await disconnectAll();
      } catch (e) {
        logger.error('drain failed', { err: (e as Error).message });
      }
      process.exit(err ? 1 : 0);
    });
    setTimeout(() => {
      logger.error('socket shutdown timeout — forcing exit');
      process.exit(1);
    }, 15_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('socket unhandledRejection', { reason: String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error('socket uncaughtException', { err: err.message, stack: err.stack });
    void shutdown('uncaughtException');
  });

  logger.info('socket-gateway bootstrapped', { port: Config.SOCKET_PORT, instance: Config.INSTANCE_ID });
}

bootstrap().catch((err) => {
  logger.error('socket bootstrap failed', { err: (err as Error).message });
  process.exit(1);
});
