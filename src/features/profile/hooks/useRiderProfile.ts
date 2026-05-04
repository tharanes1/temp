/**
 * Rider profile fetching hook.
 *
 * Fetches `/api/v1/rider/profile` on mount, exposes loading + error state,
 * and provides imperative `refresh()` and `updateProfile()` functions.
 *
 * Side effect: when the profile loads, it also pushes name + photo into the
 * UserContext so the rest of the (still-context-driven) UI stays in sync.
 * That bridge will go away once those screens consume `useRiderProfile`
 * directly.
 */
import { useCallback, useEffect, useState } from 'react';

import { useUser } from '@/core/providers/UserContext';
import { useAuthStore } from '@/features/auth/state/authStore';
import { riderService, type RiderProfile, type UpdateProfileBody } from '@/services/api/features/rider';

interface UseRiderProfileResult {
  profile: RiderProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (patch: UpdateProfileBody) => Promise<RiderProfile | null>;
}

export function useRiderProfile(): UseRiderProfileResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { updateRiderName, setProfileImage } = useUser();
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const syncIntoUserContext = useCallback(
    (p: RiderProfile) => {
      if (p.name) updateRiderName(p.name);
      if (p.profileImage) setProfileImage(p.profileImage);
    },
    [updateRiderName, setProfileImage],
  );

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const p = await riderService.getProfile();
      setProfile(p);
      syncIntoUserContext(p);
    } catch (e: unknown) {
      const msg = (e as { message?: string } | undefined)?.message ?? 'Failed to load profile';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, syncIntoUserContext]);

  const updateProfile = useCallback(
    async (patch: UpdateProfileBody): Promise<RiderProfile | null> => {
      try {
        const p = await riderService.updateProfile(patch);
        setProfile(p);
        syncIntoUserContext(p);
        return p;
      } catch (e: unknown) {
        const msg = (e as { message?: string } | undefined)?.message ?? 'Failed to update profile';
        setError(msg);
        return null;
      }
    },
    [syncIntoUserContext],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { profile, loading, error, refresh, updateProfile };
}
