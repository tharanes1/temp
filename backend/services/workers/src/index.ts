/**
 * Workers entrypoint.  Spec §2: workers run on every instance — BullMQ's
 * Redis-backed atomic claim ensures only one worker across the fleet picks
 * up each job, so we don't need leader election.
 */
import { logger } from '@cravix/shared-logger';
import { closeQueues } from '@cravix/shared-queue';
import { disconnectAll } from '@cravix/shared-redis';

import { prisma } from './prisma.js';
import { startLocationWorker } from './workers/location.js';
import { startNotificationsWorker } from './workers/notifications.js';
import { startStubWorkers } from './workers/stubs.js';

async function bootstrap(): Promise<void> {
  const workers = [
    startLocationWorker(),
    startNotificationsWorker(),
    ...startStubWorkers(),
  ];

  logger.info('workers bootstrapped', { count: workers.length });

  const shutdown = async (signal: string) => {
    logger.warn(`workers: received ${signal}, draining...`);
    try {
      await Promise.all(workers.map((w) => w.close()));
      await closeQueues();
      await prisma.$disconnect();
      await disconnectAll();
    } catch (e) {
      logger.error('workers drain failed', { err: (e as Error).message });
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error('workers: unhandledRejection', { reason: String(reason) }));
  process.on('uncaughtException', (err) => {
    logger.error('workers: uncaughtException', { err: err.message });
    void shutdown('uncaughtException');
  });
}

bootstrap().catch((err) => {
  logger.error('workers bootstrap failed', { err: (err as Error).message });
  process.exit(1);
});
