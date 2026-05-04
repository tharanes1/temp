export const ROUTES = {
  AUTH: {
    SPLASH: '/',
    LOGIN: '/login',
    OTP: '/otp',
  },
  MAIN: '/(tabs)/home',
  KYC: {
    HUB: '/kyc',
    PERSONAL: '/kyc/personal',
    DOCUMENTS: '/kyc/document-verification',
    CATEGORY: '/kyc/category',
  },
  WALLET: {
    CASH_IN_HAND: '/cashinhand',
    HISTORY: '/payment-history',
    BANKS: '/bank-accounts',
  },
  PROFILE: {
    SETTINGS: '/settings',
    DOCUMENTS: '/digital-documents',
  }
} as const;
