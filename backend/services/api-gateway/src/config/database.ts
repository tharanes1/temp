/**
 * Prisma client singleton. PgBouncer awareness — `connection_limit=5` is in
 * the DATABASE_URL itself; Prisma will respect it. Reuse one client per
 * Node process; never instantiate inside a request handler.
 */
import { logger } from '@cravix/shared-logger';
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

prisma.$on('error' as never, (e: { message: string }) =>
  logger.error('[prisma]', { err: e.message }),
);
prisma.$on('warn' as never, (e: { message: string }) =>
  logger.warn('[prisma]', { msg: e.message }),
);

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;
