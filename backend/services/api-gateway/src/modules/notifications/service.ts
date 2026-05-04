/**
 * Notifications service.
 *
 * Inbound (rider-app reads its history + alerts; registers a push token).
 * Outbound (system creates rows that arrive via socket `notification:push`
 * already wired in slice 4 / 6).
 *
 * Spec §5.9 alert cache: 60s on `cravix:cache:alerts:{city}`.
 */
import { ForbiddenError } from '@cravix/shared-errors';
import { logger } from '@cravix/shared-logger';
import { queues } from '@cravix/shared-queue';
import { cacheAside, prefixKey, redis, RedisKeys } from '@cravix/shared-redis';

import { notificationsRepository } from './repository.js';
import type { AdminAlertInput, FcmTokenInput, ListQuery } from './schemas.js';
import type { AlertDto, FcmRegisterDto, NotificationDto, ReadAllDto } from './types.js';

const ALERTS_CACHE_TTL = 60;

function projectNotification(r: import('@prisma/client').Notification): NotificationDto {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    isRead: r.isRead,
    createdAt: r.createdAt.toISOString(),
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
  };
}

function projectAlert(a: import('@prisma/client').SystemAlert): AlertDto {
  return {
    id: a.id,
    severity: a.severity as 'info' | 'warning' | 'critical',
    title: a.title,
    body: a.body,
    expiresAt: a.expiresAt.toISOString(),
    city: a.city,
  };
}

export const notificationsService = {
  async list(
    riderId: string,
    query: ListQuery,
  ): Promise<{ items: NotificationDto[]; total: number; page: number; limit: number }> {
    const { items, total } = await notificationsRepository.listForRider({
      riderId,
      page: query.page,
      limit: query.limit,
      unreadOnly: query.unreadOnly,
    });
    return {
      items: items.map(projectNotification),
      total,
      page: query.page,
      limit: query.limit,
    };
  },

  async markRead(riderId: string, notificationId: string): Promise<{ count: number }> {
    return notificationsRepository.markRead({ riderId, notificationId });
  },

  async markAllRead(riderId: string): Promise<ReadAllDto> {
    return notificationsRepository.markAllRead(riderId);
  },

  /**
   * Active alerts.  Cache key uses the city (or "global") so a city-scoped
   * alert doesn't pollute the global cache and vice versa.
   */
  async listAlerts(city?: string): Promise<AlertDto[]> {
    const key = prefixKey(`cache:alerts:${city ?? 'global'}`);
    return cacheAside(key, ALERTS_CACHE_TTL, async () => {
      const rows = await notificationsRepository.listActiveAlerts(city);
      return rows.map(projectAlert);
    });
  },

  async registerFcmToken(riderId: string, input: FcmTokenInput): Promise<FcmRegisterDto> {
    const platform = input.platform === 'android' ? 'ANDROID' : 'IOS';
    const { id } = await notificationsRepository.upsertFcmToken({
      riderId,
      token: input.fcmToken,
      platform,
    });
    // Mirror the active token into Redis for fast lookup by the workers.
    await redis.set(RedisKeys.riderFcm(riderId), input.fcmToken, 'EX', 30 * 24 * 60 * 60);
    logger.info('fcm token registered', { riderId, platform, appVersion: input.appVersion ?? null });
    return { registered: true, tokenId: id };
  },

  /**
   * Admin-issued system alert.  Inserts the row (so it shows up in
   * /notifications/alerts), invalidates the alert cache, and enqueues an
   * in-app fan-out to riders in the targeted city.  The fan-out is
   * implemented as a single socket emit subscribed to via Redis pub/sub.
   */
  async adminCreateAlert(input: AdminAlertInput): Promise<AlertDto> {
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const row = await notificationsRepository.createAlert({
      severity: input.severity,
      title: input.title,
      body: input.body,
      city: input.city ?? null,
      expiresAt,
      createdBy: 'admin', // placeholder until admin auth ships
    });

    // Invalidate the cache for the affected scope(s).
    const targetCity = input.city ?? 'global';
    await redis.del(prefixKey(`cache:alerts:${targetCity}`));
    if (targetCity !== 'global') {
      await redis.del(prefixKey('cache:alerts:global'));
    }

    // Cross-instance fan-out — the socket-gateway subscribes and re-emits.
    await redis.publish(
      'cravix:events:alert:broadcast',
      JSON.stringify({
        alert: projectAlert(row),
        targetCity: input.city ?? null,
      }),
    );

    // Optionally also enqueue an FCM fan-out — skipped for v1 because we
    // don't yet have the city → riderId index.  When the dispatcher slice
    // ships, this becomes a queries.notifications.add('fcm-broadcast', ...).

    return projectAlert(row);
  },
};

export function adminGuard(token: string | undefined, expected: string | undefined): void {
  if (!expected || !token || token !== expected) {
    throw new ForbiddenError('Invalid admin token');
  }
}
