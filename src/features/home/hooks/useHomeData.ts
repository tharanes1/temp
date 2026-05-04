import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/core/providers/UserContext';
import { useLocation } from '@/features/map/hooks/useLocation';
import { useLocalSearchParams } from 'expo-router';
import { riderService } from '@/services/api/features/rider';

export function useHomeData() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const { isOnline, setOnlineStatus, riderName, profileImage } = useUser();
  const { startTracking, stopTracking } = useLocation();
  const [tourVisible, setTourVisible] = useState(params.showTour === 'true');
  const [togglingDuty, setTogglingDuty] = useState(false);

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("home.greeting.morning", "Good Morning");
    if (hour < 17) return t("home.greeting.afternoon", "Good Afternoon");
    return t("home.greeting.evening", "Good Evening");
  }, [t]);

  /**
   * Optimistic duty toggle.
   *  1. Flip local state immediately (UI feel).
   *  2. Hit `PATCH /rider/status` so Redis (the assignment engine's source of
   *     truth, spec §13 #2) reflects the change.
   *  3. Start/stop foreground location tracking. Streaming GPS to the socket
   *     gateway lands in the Socket slice.
   *  4. On API failure, roll back the local flip and surface the error.
   */
  const toggleDuty = useCallback(async (value: boolean) => {
    if (togglingDuty) return;
    setTogglingDuty(true);
    setOnlineStatus(value);
    try {
      await riderService.setStatus(value);
      if (value) {
        await startTracking();
      } else {
        await stopTracking();
      }
    } catch (error: unknown) {
      // Roll back the optimistic flip
      setOnlineStatus(!value);
      const msg = (error as { message?: string } | undefined)?.message ?? 'Status change failed';
      if (__DEV__) console.warn('Duty toggle failed:', msg);
      throw error;
    } finally {
      setTogglingDuty(false);
    }
  }, [setOnlineStatus, startTracking, stopTracking, togglingDuty]);

  return {
    isOnline,
    riderName,
    profileImage,
    tourVisible,
    setTourVisible,
    getGreeting,
    toggleDuty,
    togglingDuty,
  };
}
