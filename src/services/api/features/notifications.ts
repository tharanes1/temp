/**
 * Notifications service — wraps /api/v1/notifications/*.
 */
import apiClient from '../client';

export const NOTIFICATIONS_ENDPOINTS = {
  LIST: '/api/v1/notifications',
  READ: (id: string) => `/api/v1/notifications/${id}/read`,
  READ_ALL: '/api/v1/notifications/read-all',
  ALERTS: '/api/v1/notifications/alerts',
  FCM_TOKEN: '/api/v1/notifications/fcm-token',
} as const;

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface SystemAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  expiresAt: string;
  city: string | null;
}

export interface FcmRegisterBody {
  fcmToken: string;
  platform: 'android' | 'ios';
  appVersion?: string;
}

interface Envelope<T> {
  success: true;
  data: T;
}
interface Paged<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const notificationsService = {
  async list(args: { page?: number; limit?: number; unreadOnly?: boolean } = {}): Promise<Paged<NotificationItem>> {
    const { data } = await apiClient.get<Paged<NotificationItem>>(NOTIFICATIONS_ENDPOINTS.LIST, {
      params: {
        page: args.page ?? 1,
        limit: args.limit ?? 20,
        unreadOnly: args.unreadOnly ?? false,
      },
    });
    return data;
  },

  async markRead(notificationId: string): Promise<{ count: number }> {
    const { data } = await apiClient.patch<Envelope<{ count: number }>>(
      NOTIFICATIONS_ENDPOINTS.READ(notificationId),
    );
    return data.data;
  },

  async markAllRead(): Promise<{ count: number }> {
    const { data } = await apiClient.patch<Envelope<{ count: number }>>(
      NOTIFICATIONS_ENDPOINTS.READ_ALL,
    );
    return data.data;
  },

  async listAlerts(city?: string): Promise<SystemAlert[]> {
    const { data } = await apiClient.get<Envelope<SystemAlert[]>>(
      NOTIFICATIONS_ENDPOINTS.ALERTS,
      { params: city ? { city } : {} },
    );
    return data.data;
  },

  async registerFcmToken(body: FcmRegisterBody): Promise<{ registered: true; tokenId: string }> {
    const { data } = await apiClient.post<Envelope<{ registered: true; tokenId: string }>>(
      NOTIFICATIONS_ENDPOINTS.FCM_TOKEN,
      body,
    );
    return data.data;
  },
};
