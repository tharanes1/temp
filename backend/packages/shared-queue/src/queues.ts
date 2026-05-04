/**
 * BullMQ queue definitions — single source of truth (spec §7).
 *
 *   • Names live here so producers + consumers can never disagree.
 *   • Job payloads are typed; producers cast through these so an unrecognised
 *     job type is a compile-time error.
 */
import { Queue, type JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';

import { Config } from '@cravix/shared-config';

// ─── Connection ──────────────────────────────────────────────────
// BullMQ requires `maxRetriesPerRequest: null` and `enableReadyCheck: false`
// on its ioredis connection (it manages reconnect itself).
let queueConn: Redis | null = null;
function conn(): Redis {
  if (queueConn) return queueConn;
  queueConn = new Redis(Config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  return queueConn;
}

// ─── Queue names ─────────────────────────────────────────────────
export const QueueName = {
  LocationUpdates: 'location-updates',
  Notifications: 'notifications',
  Payments: 'payments',
  KycVerification: 'kyc-verification',
  Emergency: 'emergency',
  RiderStatus: 'rider-status',
  EarningsSettlement: 'earnings-settlement',
} as const;

export type QueueNameValue = (typeof QueueName)[keyof typeof QueueName];

// ─── Job payloads (typed) ────────────────────────────────────────

export interface LocationUpdateJob {
  riderId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  capturedAt: number; // unix ms
}

export type NotificationJob =
  | {
      kind: 'sms-otp';
      phone: string;
      otp: string;
      ttlSec: number;
    }
  | {
      kind: 'fcm-push';
      riderId: string;
      title: string;
      body: string;
      data?: Record<string, string>;
    }
  | {
      kind: 'in-app';
      riderId: string;
      title: string;
      body: string;
      type: string;
      metadata?: Record<string, unknown>;
    };

export interface PaymentsJob {
  kind: 'penny-drop' | 'withdrawal';
  riderId: string;
  bankAccountId: string;
  amount?: number; // rupees, decimal — locked A6
  reference?: string;
}

export interface KycVerificationJob {
  riderId: string;
  applicationId: string;
}

export interface EmergencyJob {
  kind: 'sos';
  sosEventId: string;
  riderId: string;
  latitude: number;
  longitude: number;
  type: 'accident' | 'medical' | 'safety' | 'other';
}

export interface RiderStatusJob {
  riderId: string;
  isOnline: boolean;
  at: number;
}

export interface EarningsSettlementJob {
  kind: 'weekly';
  weekStart: string; // YYYY-MM-DD
}

// ─── Concrete queues ─────────────────────────────────────────────

const opts = {
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 5_000 },
    removeOnFail: { age: 24 * 3600 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 2_000 },
  } satisfies JobsOptions,
};

export const queues = {
  locationUpdates: new Queue<LocationUpdateJob>(QueueName.LocationUpdates, {
    connection: conn(),
    ...opts,
    defaultJobOptions: { ...opts.defaultJobOptions, attempts: 1 }, // location is fire-and-forget
  }),
  notifications: new Queue<NotificationJob>(QueueName.Notifications, { connection: conn(), ...opts }),
  payments: new Queue<PaymentsJob>(QueueName.Payments, { connection: conn(), ...opts }),
  kycVerification: new Queue<KycVerificationJob>(QueueName.KycVerification, { connection: conn(), ...opts }),
  emergency: new Queue<EmergencyJob>(QueueName.Emergency, {
    connection: conn(),
    ...opts,
    defaultJobOptions: { ...opts.defaultJobOptions, priority: 1 }, // critical
  }),
  riderStatus: new Queue<RiderStatusJob>(QueueName.RiderStatus, { connection: conn(), ...opts }),
  earningsSettlement: new Queue<EarningsSettlementJob>(QueueName.EarningsSettlement, { connection: conn(), ...opts }),
} as const;

/** Shutdown helper for graceful drain. */
export async function closeQueues(): Promise<void> {
  await Promise.all(Object.values(queues).map((q) => q.close()));
  if (queueConn) {
    await queueConn.quit();
    queueConn = null;
  }
}

/** Re-export the connection so workers can build identical clients. */
export function workerConnection(): Redis {
  return conn();
}
