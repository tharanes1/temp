/**
 * Secure-store wrapper for the JWT pair.
 *
 * Locked decision (BACKEND_ALIGNMENT_REVIEW §0):
 *   • access  = 3 minutes
 *   • refresh = 2 days
 *   Tokens live in iOS Keychain / Android Keystore — never AsyncStorage —
 *   to limit exposure on rooted/jailbroken devices.
 *
 * The store also keeps the access-token absolute expiry so the axios client
 * can pre-emptively refresh ~10s before expiry.
 */
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'cravix.accessToken';
const REFRESH_KEY = 'cravix.refreshToken';
const ACCESS_EXP_KEY = 'cravix.accessTokenExpiresAt';
const REFRESH_EXP_KEY = 'cravix.refreshTokenExpiresAt';

export interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  /** UNIX ms when the access token expires. */
  accessTokenExpiresAt: number;
  /** UNIX ms when the refresh token expires. */
  refreshTokenExpiresAt: number;
}

const opts: SecureStore.SecureStoreOptions = {
  // No biometric prompt — backgrounded tokens must still hydrate the app.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const secureTokenStore = {
  async save(bundle: TokenBundle): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, bundle.accessToken, opts),
      SecureStore.setItemAsync(REFRESH_KEY, bundle.refreshToken, opts),
      SecureStore.setItemAsync(ACCESS_EXP_KEY, String(bundle.accessTokenExpiresAt), opts),
      SecureStore.setItemAsync(REFRESH_EXP_KEY, String(bundle.refreshTokenExpiresAt), opts),
    ]);
  },

  async load(): Promise<TokenBundle | null> {
    const [a, r, ae, re] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
      SecureStore.getItemAsync(ACCESS_EXP_KEY),
      SecureStore.getItemAsync(REFRESH_EXP_KEY),
    ]);
    if (!a || !r || !ae || !re) return null;
    return {
      accessToken: a,
      refreshToken: r,
      accessTokenExpiresAt: Number.parseInt(ae, 10),
      refreshTokenExpiresAt: Number.parseInt(re, 10),
    };
  },

  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
      SecureStore.deleteItemAsync(ACCESS_EXP_KEY),
      SecureStore.deleteItemAsync(REFRESH_EXP_KEY),
    ]);
  },
};
