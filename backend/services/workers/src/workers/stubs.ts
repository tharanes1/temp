/**
 * Worker bundle for the queues that don't yet have a full implementation.
 *
 * Two real-shape workers live here:
 *   • `emergency` — concurrency 1, priority-1 jobs.  Confirms back to the
 *     rider via the in-app notifications channel and pages ops on-call
 *     (today a structured stub log).
 *
 * The rest are pure logging stubs so producers can enqueue without back-pressure.
 */
import { logger } from '@cravix/shared-logger';
import {
  queues,
  QueueName,
  workerConnection,
  type EarningsSettlementJob,
  type EmergencyJob,
  type KycVerificationJob,
  type PaymentsJob,
  type RiderStatusJob,
} from '@cravix/shared-queue';
import { Worker } from 'bullmq';

function stub<T>(queue: string, concurrency: number): Worker<T> {
  const w = new Worker<T>(
    queue,
    async (job) => {
      logger.info(`${queue}: job claimed (stub)`, { id: job.id, name: job.name });
      return { ok: true };
    },
    { connection: workerConnection(), concurrency },
  );
  w.on('failed', (job, err) => logger.warn(`${queue}: failed`, { id: job?.id, err: err.message }));
  w.on('error', (err) => logger.error(`${queue}: error`, { err: err.message }));
  return w;
}

function startEmergencyWorker(): Worker<EmergencyJob> {
  const w = new Worker<EmergencyJob>(
    QueueName.Emergency,
    async (job) => {
      const data = job.data;
      if (data.kind === 'sos') {
        logger.warn('[emergency] SOS', {
          sosEventId: data.sosEventId,
          riderId: data.riderId,
          type: data.type,
          lat: data.latitude,
          lng: data.longitude,
        });
        // 1. Confirmation back to the rider via in-app channel.
        await queues.notifications.add('in-app', {
          kind: 'in-app',
          riderId: data.riderId,
          type: 'sos_acknowledged',
          title: 'SOS received',
          body: `We've alerted our ops team. Help is on the way.`,
          metadata: { sosEventId: data.sosEventId, type: data.type },
        });
        // 2. Page the ops on-call group — structured stub until PagerDuty / Opsgenie wires.
        logger.warn('[emergency:page] would page ops on-call', {
          sosEventId: data.sosEventId,
          riderId: data.riderId,
        });
      }
      return { ok: true };
    },
    { connection: workerConnection(), concurrency: 1 },
  );
  w.on('failed', (job, err) => logger.error('emergency: failed', { id: job?.id, err: err.message }));
  w.on('error', (err) => logger.error('emergency: error', { err: err.message }));
  return w;
}

export function startStubWorkers(): Worker[] {
  return [
    stub<PaymentsJob>(QueueName.Payments, 5),
    stub<KycVerificationJob>(QueueName.KycVerification, 3),
    startEmergencyWorker(),
    stub<RiderStatusJob>(QueueName.RiderStatus, 10),
    stub<EarningsSettlementJob>(QueueName.EarningsSettlement, 2),
  ];
}
