/**
 * Auth service — wraps the four /api/v1/auth/* endpoints.
 *
 * Locked decisions (BACKEND_ALIGNMENT_REVIEW §0):
 *   A1 — OTP is 4 digits
 *   A2 — verify returns { token /* access 3m *\/, refreshToken /* 2d *\/, ... }
 */
import apiClient from '../client';

export const AUTH_ENDPOINTS = {
  LOGIN: '/api/v1/auth/login',
  VERIFY: '/api/v1/auth/verify',
  REFRESH: '/api/v1/auth/refresh',
  LOGOUT: '/api/v1/auth/logout',
} as const;

export interface LoginResponse {
  success: true;
  message?: string;
  data: { expiresIn: number };
}

export interface VerifyResponseData {
  token: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  user: {
    id: string;
    phone: string;
    name: string | null;
    profileImage: string | null;
    isKycComplete: boolean;
    consentAccepted: boolean;
  };
}

export interface VerifyResponse {
  success: true;
  data: VerifyResponseData;
}

export const authService = {
  login: async (phone: string): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>(AUTH_ENDPOINTS.LOGIN, { phone });
    return data;
  },

  verify: async (
    phone: string,
    otp: string,
    consentVersion?: string,
  ): Promise<VerifyResponse> => {
    const payload: Record<string, string> = { phone, otp };
    if (consentVersion) payload.consentVersion = consentVersion;
    const { data } = await apiClient.post<VerifyResponse>(AUTH_ENDPOINTS.VERIFY, payload);
    return data;
  },

  refresh: async (refreshToken: string): Promise<VerifyResponse> => {
    const { data } = await apiClient.post<VerifyResponse>(AUTH_ENDPOINTS.REFRESH, { refreshToken });
    return data;
  },

  logout: async (): Promise<{ success: boolean }> => {
    try {
      const { data } = await apiClient.post<{ success: boolean }>(AUTH_ENDPOINTS.LOGOUT);
      return data;
    } catch {
      // Logout is best-effort — even if the server is unreachable, the local
      // SecureStore is still cleared by the caller.
      return { success: true };
    }
  },
};
