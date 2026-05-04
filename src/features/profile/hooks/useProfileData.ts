import { useState, useCallback } from 'react';
import { Alert, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/core/providers/UserContext';
import { RIDER_PROFILE } from '@/core/config/user';
import { useAuthStore } from '@/features/auth/state/authStore';
import { authService } from '@/services/api/features/auth';
import { riderService } from '@/services/api/features/rider';

export function useProfileData() {
  const router = useRouter();
  const { t } = useTranslation();
  const { riderName, profileImage, setProfileImage, updateRiderName } = useUser();
  const [kycPhone, setKycPhone] = useState<string>(RIDER_PROFILE.phone);
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const [showMenuModal, setShowMenuModal] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      // Source of truth: GET /rider/profile.  AsyncStorage `@personal_data` is
      // only consulted as a last-resort fallback for offline launches; the API
      // response always wins when it arrives.
      let cancelled = false;
      const loadProfile = async () => {
        try {
          const profile = await riderService.getProfile();
          if (cancelled) return;
          if (profile.name) updateRiderName(profile.name);
          if (profile.profileImage) setProfileImage(profile.profileImage);
          if (profile.phone) setKycPhone(profile.phone);
        } catch (e: unknown) {
          if (cancelled) return;
          // Offline / pre-auth fallback: hydrate from the local KYC blob so
          // the screen still has something to render. The next foreground
          // refresh will reconcile.
          try {
            const savedPersonal = await AsyncStorage.getItem("@personal_data");
            const savedPhoto = await AsyncStorage.getItem("@kyc_profile_photo");
            if (savedPersonal) {
              const parsed = JSON.parse(savedPersonal);
              if (parsed.fullName) updateRiderName(parsed.fullName);
              else if (parsed.name) updateRiderName(parsed.name);
              if (parsed.mobile) setKycPhone(parsed.mobile);
            }
            if (savedPhoto) setProfileImage(savedPhoto);
          } catch {
            // ignore
          }
          if (__DEV__) console.warn('Profile sync failed; using local fallback');
        }
      };
      void loadProfile();
      return () => {
        cancelled = true;
      };
    }, [updateRiderName, setProfileImage]),
  );

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.push("/(tabs)/home");
        return true;
      };
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => subscription.remove();
    }, [router]),
  );

  const handleLogout = async () => {
    // Best-effort server revoke (clears refresh-token hash in Redis); local
    // SecureStore is wiped by useAuthStore.logout() regardless of network.
    try {
      await authService.logout();
    } catch {
      // ignore — local wipe still proceeds
    }
    await useAuthStore.getState().logout();
    setShowLogoutModal(false);
    router.replace("/login");
  };

  const handleEditPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("profile.photo_permission_title"),
          t("profile.photo_permission_msg"),
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0].uri) {
        const newPhotoUri = result.assets[0].uri;
        // Optimistically update locally; persist for cold-start fallback.
        setProfileImage(newPhotoUri);
        await AsyncStorage.setItem("@kyc_profile_photo", newPhotoUri);
        // Server-side sync — the URL must be S3 in prod (presigned upload
        // pipeline lands in the KYC slice). Until then we accept the local
        // file:// URI and the API rejects with VALIDATION_ERROR; the local
        // copy still renders.
        try {
          if (/^https?:\/\//.test(newPhotoUri)) {
            await riderService.updateProfile({ profileImage: newPhotoUri });
          }
        } catch (e) {
          if (__DEV__) console.warn('Server profile-image update failed; local copy retained');
        }
        Alert.alert(t("common.success"), t("profile.photo_success_msg"));
      }
    } catch (error) {
      console.error("Photo Pick Error:", error);
      Alert.alert(t("common.error"), t("profile.photo_error_msg"));
    }
  };

  return {
    riderName,
    profileImage,
    kycPhone,
    showLogoutModal,
    setShowLogoutModal,
    showMenuModal,
    setShowMenuModal,
    handleLogout,
    handleEditPhoto,
    t,
  };
}
