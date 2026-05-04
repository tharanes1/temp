/**
 * KYC status hook — replaces the legacy AsyncStorage scraper.
 *
 * Source of truth: `GET /api/v1/kyc/status`.  Refetched on focus and
 * imperative `refresh()`.  Exposes the spec-shaped DTO plus the legacy
 * convenience flags (isPersonalDone, isDocsDone, …) so existing screens that
 * read those names continue to work without touching their JSX.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuthStore } from '@/features/auth/state/authStore';
import { kycService, type KycStatus, type KycStep } from '@/services/api/features/kyc';

export interface UseKycStatusResult {
  /** Spec-shaped DTO (null until first load completes). */
  status: KycStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isComplete: (step: KycStep) => boolean;
  isVerified: boolean;
  isUnderReview: boolean;

  // ── Legacy flags kept for backward-compat with ReviewScreen JSX ──
  isPersonalDone: boolean;
  isDocsDone: boolean;
  isCategoryDone: boolean;
  isEmergencyDone: boolean;
  progressPercent: number;
  isAllDone: boolean;
  /** Imperative refresh — kept for callers using the previous name. */
  checkStatus: () => Promise<void>;
  /** Sub-category type ('student' | 'professional' | 'disabled' | ''). */
  categoryType: string;
}

export function useKycStatus(): UseKycStatusResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const next = await kycService.getStatus();
      setStatus(next);
    } catch (e: unknown) {
      const msg = (e as { message?: string } | undefined)?.message ?? 'Failed to load KYC status';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const isComplete = useCallback(
    (step: KycStep) => status?.completedSteps.includes(step) ?? false,
    [status],
  );

  const isPersonalDone = isComplete('personal');
  const isDocsDone = isComplete('documents');
  // "Category done" means BOTH the category step AND the matching sub-flow
  // (student/disabled) when applicable.
  const isCategoryDone =
    isComplete('category') &&
    (status?.subCategory === 'professional'
      ? true
      : status?.subCategory === 'student'
      ? isComplete('student')
      : status?.subCategory === 'disabled'
      ? isComplete('disabled')
      : false);
  const isEmergencyDone = true; // emergency contact captured separately; not part of KYC steps

  const totalSteps = 4;
  const completedSteps = [isPersonalDone, isDocsDone, isCategoryDone, isEmergencyDone].filter(Boolean).length;
  const progressPercent = status?.progressPercent ?? Math.round((completedSteps / totalSteps) * 100);
  const isAllDone = completedSteps === totalSteps;

  return {
    status,
    loading,
    error,
    refresh,
    isComplete,
    isVerified: status?.status === 'verified',
    isUnderReview: status?.status === 'under_review',
    isPersonalDone,
    isDocsDone,
    isCategoryDone,
    isEmergencyDone,
    progressPercent,
    isAllDone,
    checkStatus: refresh,
    categoryType: status?.subCategory ?? '',
  };
}
