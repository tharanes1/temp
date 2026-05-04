/**
 * Zod schemas for /api/v1/notifications/*.
 */
import { z } from 'zod';

export const ListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    unreadOnly: z.coerce.boolean().default(false),
  })
  .strict();
export type ListQuery = z.infer<typeof ListQuerySchema>;

export const NotificationIdParam = z
  .object({
    notificationId: z.string().min(1).max(64),
  })
  .strict();

/**
 * `fcmToken` length range comes from the Firebase docs: tokens are typically
 * 142–200 chars on Android, but APNs token wrapping pushes them up to 250.
 * The 50–500 floor/ceiling is generous — invalid tokens get rejected by FCM
 * itself, not by us.
 */
export const FcmTokenSchema = z
  .object({
    fcmToken: z.string().min(50).max(500),
    platform: z.enum(['android', 'ios']),
    appVersion: z.string().max(40).optional(),
  })
  .strict();
export type FcmTokenInput = z.infer<typeof FcmTokenSchema>;

/**
 * Admin endpoint — broadcasts a system alert.  Token-gated identical to the
 * order admin endpoint.
 */
export const AdminAlertSchema = z
  .object({
    severity: z.enum(['info', 'warning', 'critical']).default('info'),
    title: z.string().trim().min(2).max(200),
    body: z.string().trim().min(2).max(1000),
    city: z.string().trim().max(80).optional(),
    /** ISO timestamp; defaults to +24 hours. */
    expiresAt: z.string().datetime().optional(),
  })
  .strict();
export type AdminAlertInput = z.infer<typeof AdminAlertSchema>;
