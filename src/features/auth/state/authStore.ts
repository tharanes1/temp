/**
 * Auth store. Holds the in-memory user + access token, with the persisted
 * pair living in expo-secure-store.
 *
 * Locked decisions (BACKEND_ALIGNMENT_REVIEW §0):
 *   A2 — `data.token` (3-min access) + `data.refreshToken` (2-day refresh).
 *        One source of truth in this store; SecureStore for cross-launch
 *        persistence.  AsyncStorage is no longer used for tokens.
 */
import { create } from 'zustand';

import { secureTokenStore, type TokenBundle } from '@/services/storage/secureTokenStore';
import socketClient from '@/services/socket/socketClient';
import { registerForPushNotifications } from '@/services/notifications/push';

export interface User {
  id: string;
  phone: string;
  name?: string | null;
  profileImage?: string | null;
  isKycComplete?: boolean;
  consentAccepted?: boolean;
}

export interface AuthSetPayload {
  token: string;            // access (3m)
  refreshToken: string;     // refresh (2d)
  expiresIn: number;        // seconds (access)
  refreshExpiresIn: number; // seconds (refresh)
  user: User;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: number | null;
  user: User | null;
  isAuthenticated: boolean;
  isHydrating: boolean;

  /** Persists tokens to SecureStore and updates in-memory state. */
  setAuth: (payload: AuthSetPayload) => Promise<void>;
  /** Quick refresh-only update — no user change. */
  setTokens: (args: {
    token: string;
    refreshToken: string;
    expiresIn: number;
    refreshExpiresIn: number;
  }) => Promise<void>;
  /** Wipes both in-memory and SecureStore. */
  logout: () => Promise<void>;
  /** Read SecureStore on app launch and re-hydrate. */
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  token: null,
  refreshToken: null,
  accessTokenExpiresAt: null,
  user: null,
  isAuthenticated: false,
  isHydrating: true,

  setAuth: async (payload) => {
    const now = Date.now();
    const bundle: TokenBundle = {
      accessToken: payload.token,
      refreshToken: payload.refreshToken,
      accessTokenExpiresAt: now + payload.expiresIn * 1000,
      refreshTokenExpiresAt: now + payload.refreshExpiresIn * 1000,
    };
    await secureTokenStore.save(bundle);
    set({
      token: bundle.accessToken,
      refreshToken: bundle.refreshToken,
      accessTokenExpiresAt: bundle.accessTokenExpiresAt,
      user: payload.user,
      isAuthenticated: true,
    });
    // Open the realtime channel — JWT-handshake on /socket.io.
    socketClient.connect(bundle.accessToken);
    // Register for FCM/APNs push — fire-and-forget, best-effort.
    void registerForPushNotifications();
  },

  setTokens: async ({ token, refreshToken, expiresIn, refreshExpiresIn }) => {
    const now = Date.now();
    const bundle: TokenBundle = {
      accessToken: token,
      refreshToken,
      accessTokenExpiresAt: now + expiresIn * 1000,
      refreshTokenExpiresAt: now + refreshExpiresIn * 1000,
    };
    await secureTokenStore.save(bundle);
    set({
      token: bundle.accessToken,
      refreshToken: bundle.refreshToken,
      accessTokenExpiresAt: bundle.accessTokenExpiresAt,
    });
    // Re-handshake with the rotated access token.
    socketClient.refreshAuthToken(bundle.accessToken);
  },

  logout: async () => {
    socketClient.disconnect();
    await secureTokenStore.clear();
    set({
      token: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      user: null,
      isAuthenticated: false,
    });
  },

  initialize: async () => {
    try {
      const bundle = await secureTokenStore.load();
      if (!bundle) {
        set({ isHydrating: false });
        return;
      }
      // If the refresh token is already expired, drop everything — the rider
      // must log in fresh.
      if (Date.now() >= bundle.refreshTokenExpiresAt) {
        await secureTokenStore.clear();
        set({ isHydrating: false });
        return;
      }
      set({
        token: bundle.accessToken,
        refreshToken: bundle.refreshToken,
        accessTokenExpiresAt: bundle.accessTokenExpiresAt,
        // We don't persist the user object — first authenticated request
        // will refresh it; until then keep authenticated=true so the UI doesn't
        // bounce back to /login on cold-start.
        isAuthenticated: true,
        isHydrating: false,
      });
      // Re-open the realtime channel using the rehydrated access token.
      socketClient.connect(bundle.accessToken);
      // Re-validate / re-register the push token on cold-start (token may
      // have rotated while the app was closed).
      void registerForPushNotifications();
    } catch {
      set({ isHydrating: false });
    }

    void get; // silence unused
  },
}));

/** Convenience helpers for non-React call sites. */
export const authSnapshot = () => useAuthStore.getState();
