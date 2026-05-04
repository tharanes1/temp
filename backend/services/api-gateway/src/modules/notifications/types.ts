/**
 * Wire-format DTOs for /notifications.
 */

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface AlertDto {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  expiresAt: string;
  /** Optional — null when the alert is global (not scoped to one city). */
  city: string | null;
}

export interface FcmRegisterDto {
  registered: true;
  tokenId: string;
}

export interface ReadAllDto {
  count: number;
}
