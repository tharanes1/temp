/**
 * Persistence for notifications + alerts + FCM tokens.
 */
import { Prisma, type DeviceOS, type Notification, type SystemAlert } from '@prisma/client';

import { prisma } from '../../config/database.js';

export const notificationsRepository = {
  async listForRider(args: {
    riderId: string;
    page: number;
    limit: number;
    unreadOnly: boolean;
  }): Promise<{ items: Notification[]; total: number }> {
    const where: Prisma.NotificationWhereInput = { riderId: args.riderId };
    if (args.unreadOnly) where.isRead = false;
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (args.page - 1) * args.limit,
        take: args.limit,
      }),
      prisma.notification.count({ where }),
    ]);
    return { items, total };
  },

  async markRead(args: { riderId: string; notificationId: string }): Promise<{ count: number }> {
    const r = await prisma.notification.updateMany({
      where: { id: args.notificationId, riderId: args.riderId, isRead: false },
      data: { isRead: true },
    });
    return { count: r.count };
  },

  async markAllRead(riderId: string): Promise<{ count: number }> {
    const r = await prisma.notification.updateMany({
      where: { riderId, isRead: false },
      data: { isRead: true },
    });
    return { count: r.count };
  },

  async listActiveAlerts(city?: string): Promise<SystemAlert[]> {
    const now = new Date();
    return prisma.systemAlert.findMany({
      where: {
        isActive: true,
        expiresAt: { gt: now },
        OR: [{ city: null }, ...(city ? [{ city }] : [])],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },

  async createAlert(args: {
    severity: 'info' | 'warning' | 'critical';
    title: string;
    body: string;
    city: string | null;
    expiresAt: Date;
    createdBy: string | null;
  }): Promise<SystemAlert> {
    return prisma.systemAlert.create({
      data: {
        severity: args.severity,
        title: args.title,
        body: args.body,
        city: args.city,
        expiresAt: args.expiresAt,
        createdBy: args.createdBy,
      },
    });
  },

  async upsertFcmToken(args: {
    riderId: string;
    token: string;
    platform: DeviceOS;
  }): Promise<{ id: string }> {
    // De-dup by token uniqueness; same token re-used across logins is just a
    // touch on `lastSeen`.  Different rider re-uses someone else's token (rare,
    // happens when devices change ownership) — re-bind to the new rider.
    return prisma.fcmToken.upsert({
      where: { token: args.token },
      create: {
        riderId: args.riderId,
        token: args.token,
        platform: args.platform,
        active: true,
      },
      update: {
        riderId: args.riderId,
        platform: args.platform,
        active: true,
        lastSeen: new Date(),
      },
      select: { id: true },
    });
  },
};
