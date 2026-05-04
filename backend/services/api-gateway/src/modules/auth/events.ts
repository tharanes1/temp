/**
 * Domain-event names for the Auth module. Other slices import these constants
 * to subscribe (e.g. notifications listens for AUTH_OTP_REQUESTED to send SMS).
 */
export const AuthEvents = {
  OTP_REQUESTED: 'auth.otp.requested',
  OTP_VERIFIED: 'auth.otp.verified',
  OTP_FAILED: 'auth.otp.failed',
  REFRESH_ROTATED: 'auth.refresh.rotated',
  TOKEN_REUSE_DETECTED: 'auth.token.reuse_detected',
  LOGOUT: 'auth.logout',
} as const;

export type AuthEventName = (typeof AuthEvents)[keyof typeof AuthEvents];
