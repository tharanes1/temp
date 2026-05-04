/**
 * Environment-driven configuration. Reads from `expo-constants.expoConfig.extra`
 * which is populated by the `extra` block in `app.json` (per-env via EAS).
 *
 * NOTE: This replaces the previous hardcoded ENV constants. The two LAN-IP
 * baseURLs that lived in `services/api/client.ts` and `services/socket/socketClient.ts`
 * now flow through here.
 */
import Constants from 'expo-constants';

interface ExpoExtra {
  apiUrl?: string;
  socketUrl?: string;
  isProd?: boolean;
}

const extra: ExpoExtra =
  (Constants.expoConfig?.extra as ExpoExtra | undefined) ??
  ((Constants.manifest2 as unknown as { extra?: ExpoExtra } | undefined)?.extra ?? {});

const isDev = __DEV__;

export const ENV = {
  // Defaults are dev-only LAN. Override via app.json extra block in EAS profiles.
  API_URL: extra.apiUrl ?? (isDev ? 'http://10.20.79.36:3000' : 'https://api.cravix.in'),
  SOCKET_URL: extra.socketUrl ?? (isDev ? 'http://192.168.1.100:5000' : 'https://socket.cravix.in'),
  IS_PROD: extra.isProd ?? !isDev,
  VERSION: Constants.expoConfig?.version ?? '1.0.0',
} as const;
