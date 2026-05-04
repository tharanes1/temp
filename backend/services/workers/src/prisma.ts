import { logger } from '@cravix/shared-logger';
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prismaWorkers: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prismaWorkers ??
  new PrismaClient({
    log: [{ emit: 'event', level: 'error' }, { emit: 'event', level: 'warn' }],
  });

prisma.$on('error' as never, (e: { message: string }) => logger.error('[prisma:workers]', { err: e.message }));
prisma.$on('warn' as never, (e: { message: string }) => logger.warn('[prisma:workers]', { msg: e.message }));

if (process.env.NODE_ENV !== 'production') global.__prismaWorkers = prisma;
