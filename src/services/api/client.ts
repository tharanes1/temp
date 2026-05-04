/**
 * Axios client.
 *
 * Locked decisions (BACKEND_ALIGNMENT_REVIEW §0):
 *   • baseURL comes from ENV (per-env via app.json extra) — no more LAN IPs in code.
 *   • On 401, attempt one /auth/refresh transparently before giving up. Only
 *     after a refresh failure do we logout.
 *   • Concurrent 401s share a single in-flight refresh so we never thunder the
 *     server with N parallel refresh calls when N requests hit 401 at once.
 */
import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import { ENV } from '@/core/config/env';
import { useAuthStore } from '@/features/auth/state/authStore';

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

const apiClient: AxiosInstance = axios.create({
  baseURL: ENV.API_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request: attach access token ────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response: refresh-on-401 with single-flight ────────────────
let inflightRefresh: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const { refreshToken, setTokens, logout } = useAuthStore.getState();
  if (!refreshToken) {
    await logout();
    return null;
  }
  try {
    // Use a bare axios call — bypass interceptors so we don't loop.
    const { data } = await axios.post(
      `${ENV.API_URL}/api/v1/auth/refresh`,
      { refreshToken },
      { timeout: 10_000, headers: { 'Content-Type': 'application/json' } },
    );
    if (!data?.success || !data?.data?.token) {
      await logout();
      return null;
    }
    await setTokens({
      token: data.data.token,
      refreshToken: data.data.refreshToken,
      expiresIn: data.data.expiresIn,
      refreshExpiresIn: data.data.refreshExpiresIn,
    });
    return data.data.token as string;
  } catch {
    await logout();
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    // Only retry once, only on 401, only if we have a refresh token.
    const canRetry =
      status === 401 &&
      original &&
      !original._retried &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/verify');

    if (canRetry) {
      original._retried = true;
      inflightRefresh ??= performRefresh().finally(() => {
        inflightRefresh = null;
      });
      const newToken = await inflightRefresh;
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient.request(original);
      }
    }

    // Normalize error envelope so callers see a stable shape.
    const body = error.response?.data as
      | { error?: { code?: string; message?: string }; message?: string }
      | undefined;
    const normalized = {
      message: body?.error?.message ?? body?.message ?? error.message ?? 'Network error',
      code: body?.error?.code ?? error.code ?? 'NETWORK_ERROR',
      status,
    };
    return Promise.reject(normalized);
  },
);

export default apiClient;
