/**
 * Health probes — `/health/live` for K8s liveness, `/health/ready` for
 * readiness (verifies Postgres + Redis are reachable).
 */
import { redis } from '@cravix/shared-redis';
import type { Request, Response } from 'express';

import { prisma } from '../config/database.js';

export async function liveness(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: { status: 'ok' } });
}

export async function readiness(_req: Request, res: Response): Promise<void> {
  const checks: Record<string, 'ok' | string> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = 'ok';
  } catch (e) {
    checks.postgres = (e as Error).message;
  }
  try {
    const pong = await redis.ping();
    checks.redis = pong === 'PONG' ? 'ok' : pong;
  } catch (e) {
    checks.redis = (e as Error).message;
  }
  const ok = Object.values(checks).every((v) => v === 'ok');
  res.status(ok ? 200 : 503).json({ success: ok, data: checks });
}
