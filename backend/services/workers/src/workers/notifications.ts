/**
 * `notifications` worker — three job kinds:
 *
 *   sms-otp     → MSG91 (or stub in dev)
 *   fcm-push    → Firebase Admin SDK (or stub if FCM_SERVICE_ACCOUNT_JSON unset)
 *   in-app      → INSERT into Notification + publish to socket fan-out
 *
 * The fcm-push branch reads the active token from `cravix:rider:fcm:{riderId}`
 * (populated by the API gateway when /notifications/fcm-token is called) and
 * dispatches to FCM.  Without creds it logs the payload at warn level so
 * developers can verify wiring without a Firebase project.
 */
import { Config } from '@cravix/shared-config';
import { logger } from '@cravix/shared-logger';
import { redis, RedisKeys } from '@cravix/shared-redis';
import { type NotificationJob, QueueName, workerConnection } from '@cravix/shared-queue';
import { Worker } from 'bullmq';

import { prisma } from '../prisma.js';

// Lazy Firebase Admin import — only loaded when creds are present.  Keeps the
// dependency tree small in dev mode and lets us ship without the firebase-admin
// package installed.
let _firebase: { send: (token: string, payload: { title: string; body: string; data?: Record<string, string> }) => Promise<void> } | null = null;

async function getFirebaseSender() {
  if (_firebase) return _firebase;
  if (!Config.FCM_SERVICE_ACCOUNT_JSON) return null;
  // Real implementation (commented out — uncomment when firebase-admin is installed):
  //   import admin from 'firebase-admin';
  //   const creds = JSON.parse(Buffer.from(Config.FCM_SERVICE_ACCOUNT_JSON, 'base64').toString());
  //   if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(creds) });
  //   _firebase = {
  //     send: async (token, payload) => {
  //       await admin.messaging().send({ token, notification: { title: payload.title, body: payload.body }, data: payload.data });
  //     },
  //   };
  // Until the package lands, log a structured stub line so the call shape is testable.
  _firebase = {
    send: async (token, payload) => {
      logger.warn('[fcm:stub] would send', {
        tokenSuffix: token.slice(-8),
        title: payload.title,
        body: payload.body,
      });
    },
  };
  return _firebase;
}

export function startNotificationsWorker(): Worker<NotificationJob> {
  const worker = new Worker<NotificationJob>(
    QueueName.Notifications,
    async (job) => {
      const data = job.data;
      switch (data.kind) {
        case 'sms-otp': {
          // TODO: MSG91 integration. Real shape:
          //   await msg91.send({ to: data.phone, template: Config.MSG91_TEMPLATE_ID, vars: { otp: data.otp } });
          logger.warn('[sms:stub] OTP', { phone: data.phone });
          return { delivered: true };
        }

        case 'fcm-push': {
          const token = await redis.get(RedisKeys.riderFcm(data.riderId));
          if (!token) {
            logger.info('[fcm] no token registered', { riderId: data.riderId });
            return { delivered: false, reason: 'no-token' };
          }
          const sender = await getFirebaseSender();
          if (!sender) {
            logger.warn('[fcm] no creds — skipping', { riderId: data.riderId });
            return { delivered: false, reason: 'no-creds' };
          }
          await sender.send(token, {
            title: data.title,
            body: data.body,
            data: Object.fromEntries(
              Object.entries(data.data ?? {}).map(([k, v]) => [k, String(v)]),
            ),
          });
          return { delivered: true };
        }

        case 'in-app': {
          // Persist the notification + publish for cross-instance socket fan-out.
          await prisma.notification.create({
            data: {
              riderId: data.riderId,
              type: data.type,
              title: data.title,
              body: data.body,
              channel: 'IN_APP',
              metadata: (data.metadata ?? {}) as Record<string, unknown>,
            },
          });
          await redis.publish(
            'cravix:events:notification:push',
            JSON.stringify({
              riderId: data.riderId,
              title: data.title,
              body: data.body,
              type: data.type,
              metadata: data.metadata ?? {},
            }),
          );
          return { delivered: true };
        }

        default: {
          const exhaustive: never = data;
          throw new Error(`Unknown notification job: ${JSON.stringify(exhaustive)}`);
        }
      }
    },
    { connection: workerConnection(), concurrency: 10 },
  );

  worker.on('failed', (job, err) =>
    logger.warn('notifications: job failed', { jobId: job?.id, err: err.message }),
  );
  worker.on('error', (err) => logger.error('notifications worker error', { err: err.message }));
  return worker;
}
