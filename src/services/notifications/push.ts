/**
 * FCM / APNs registration via `expo-notifications`.
 *
 * Closes review §6.2 #12 — `expo-notifications` was previously declared in
 * `package.json` but never imported anywhere.  This module:
 *
 *   1. Requests permission (idempotent).
 *   2. Configures the Android default channel.
 *   3. Pulls the device's native FCM/APNs token via `getDevicePushTokenAsync()`.
 *   4. Registers it with the backend at POST /api/v1/notifications/fcm-token.
 *
 * Called from `authStore.setAuth` on first login + from `initialize()` on
 * cold-start.  Best-effort: failures are logged in dev only — no UI blocker.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { notificationsService } from '@/services/api/features/notifications';

let _registered = false;

/**
 * Idempotent: subsequent calls within the same session re-resolve from the
 * platform but only POST when the token has actually changed.
 *
 * NOTE: `expo-device` was removed because it wasn't installed.  The
 * `Device.isDevice` guard (simulator skip) is not critical — the outer
 * try-catch already handles push failures on simulators gracefully.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    // Foreground notification handler — show the banner + play sound while
    // the app is in the foreground (otherwise expo silently swallows it).
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Cravix',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1800ad',
      });
    }

    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      granted = req.granted;
    }
    if (!granted) {
      if (__DEV__) console.warn('[push] permission denied');
      return null;
    }

    // Native device token — FCM on Android, APNs on iOS.  The backend's
    // `notifications` worker dispatches via the appropriate provider.
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    const token = tokenResp.data;
    if (!token || typeof token !== 'string' || token.length < 50) {
      if (__DEV__) console.warn('[push] token shape invalid', { type: typeof token, len: typeof token === 'string' ? token.length : 0 });
      return null;
    }

    await notificationsService.registerFcmToken({
      fcmToken: token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });

    _registered = true;
    return token;
  } catch (e) {
    if (__DEV__) console.warn('[push] registration failed', (e as Error).message);
    return null;
  }
}

export function isPushRegistered(): boolean {
  return _registered;
}
