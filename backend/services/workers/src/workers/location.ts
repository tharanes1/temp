/**
 * `location-updates` worker — spec §7.
 *
 * Architecture (locked spec §13 #1):
 *   1. Each job arrives with one location ping.
 *   2. The worker buffers it in a per-rider Redis list.
 *   3. A 30-second timer flushes ALL buffered pings to Postgres in a single
 *      `prisma.locationHistory.createMany` per rider.  This collapses N
 *      pings/rider/30s into one DB write.
 *   4. The Redis GeoSet + `cravix:rider:location:{id}` were already updated
 *      by the socket-gateway BEFORE this job was enqueued, so realtime
 *      consumers (assignment engine) see locations immediately — the worker
 *      is purely about durable history.
 */
import { logger } from '@cravix/shared-logger';
import { redis, prefixKey } from '@cravix/shared-redis';
import { type LocationUpdateJob, QueueName, workerConnection } from '@cravix/shared-queue';
import { Worker, type Job } from 'bullmq';

import { prisma } from '../prisma.js';

const FLUSH_INTERVAL_MS = 30_000;
const BUFFER_MAX_PER_RIDER = 200; // ~16 minutes of 5s pings — safety cap
const RIDERS_TOUCHED = prefixKey('locbuf:riders');

function bufferKey(riderId: string): string {
  return prefixKey(`locbuf:${riderId}`);
}

export function startLocationWorker(): Worker<LocationUpdateJob> {
  const worker = new Worker<LocationUpdateJob>(
    QueueName.LocationUpdates,
    async (job: Job<LocationUpdateJob>) => {
      const { riderId } = job.data;
      const key = bufferKey(riderId);
      // LPUSH + LTRIM so the buffer never grows unbounded between flushes.
      await redis
        .multi()
        .lpush(key, JSON.stringify(job.data))
        .ltrim(key, 0, BUFFER_MAX_PER_RIDER - 1)
        .sadd(RIDERS_TOUCHED, riderId)
        .exec();
    },
    {
      connection: workerConnection(),
      concurrency: 20, // spec §7 — 20 per instance
    },
  );

  worker.on('failed', (job, err) =>
    logger.warn('location-worker: job failed', { jobId: job?.id, err: err.message }),
  );
  worker.on('error', (err) => logger.error('location-worker: error', { err: err.message }));

  // ── 30-second flusher ───────────────────────────────────────
  const flusher = setInterval(() => {
    void flushAll();
  }, FLUSH_INTERVAL_MS);
  flusher.unref();

  return worker;
}

async function flushAll(): Promise<void> {
  let riders: string[] = [];
  try {
    // SPOP up to 1000 riders at once — atomic claim across instances.
    riders = (await redis.spop(RIDERS_TOUCHED, 1000)) as string[];
  } catch (e) {
    logger.warn('location-worker: spop failed', { err: (e as Error).message });
    return;
  }
  if (!riders || riders.length === 0) return;

  // For each rider claimed, drain their buffer and write in one batch.
  await Promise.all(riders.map(flushOne));
}

async function flushOne(riderId: string): Promise<void> {
  const key = bufferKey(riderId);
  const raw = await redis.lrange(key, 0, -1);
  if (raw.length === 0) return;
  await redis.del(key);

  const records = raw
    .map((line) => {
      try {
        return JSON.parse(line) as LocationUpdateJob;
      } catch {
        return null;
      }
    })
    .filter((v): v is LocationUpdateJob => v !== null)
    .map((p) => ({
      riderId: p.riderId,
      latitude: p.latitude,
      longitude: p.longitude,
      heading: p.heading ?? null,
      speed: p.speed ?? null,
      accuracy: p.accuracy ?? null,
      capturedAt: new Date(p.capturedAt),
    }));

  if (records.length === 0) return;

  try {
    await prisma.locationHistory.createMany({ data: records });
    logger.debug?.('location-worker: flushed', { riderId, count: records.length });
  } catch (e) {
    // Push back into the buffer so the next interval retries.  Drop on
    // sustained Postgres outage rather than fail the whole worker.
    logger.error('location-worker: flush failed', { riderId, err: (e as Error).message });
    if (raw.length <= BUFFER_MAX_PER_RIDER) {
      await redis.rpush(key, ...raw);
      await redis.sadd(RIDERS_TOUCHED, riderId);
    }
  }
}
