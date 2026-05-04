import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Modal, 
  Alert 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useTranslation } from 'react-i18next';

// Theme & Utils
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING } from "@/shared/theme";

// Feedback
import { useTourStore } from '@/shared/store/tourStore';
import { useSpotlightTour } from '@/shared/hooks/useSpotlightTour';

// Profile Feature Components & Hooks
import { useProfileData } from '../hooks/useProfileData';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProCard } from '../components/ProCard';
import { QuickActions } from '../components/QuickActions';
import { MenuList } from '../components/MenuList';

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tabBarHeight = useBottomTabBarHeight();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  
  const { t } = useTranslation();
  const {
    riderName,
    profileImage,
    kycPhone,
    showLogoutModal,
    setShowLogoutModal,
    showMenuModal,
    setShowMenuModal,
    handleLogout,
    handleEditPhoto,
  } = useProfileData();

  const rating = "4.9"; // Fallback as it's missing in data hook

  // Precision Refs for Absolute Measurement
  const refs = {
    identity: useRef<View>(null),
    pro: useRef<View>(null),
    quick: useRef<View>(null),
    menu: useRef<View>(null),
  };

  const keys = ['identity', 'pro', 'quick', 'menu'];

  const { measureAndStart } = useTourStore();

  const { onScrollBeginDrag, onMomentumScrollEnd, onLayoutTarget } = useSpotlightTour({ refs, scrollRef, keys });

  const [tourVisible, setTourVisible] = useState(params.showTour === 'true');

  useEffect(() => {
    if (!tourVisible) return;
    setTourVisible(false);
    measureAndStart([
      { title: "Rider Identity", desc: "Your public profile and rating. High ratings unlock exclusive city missions.", icon: "person-circle-outline", iconType: "Ionicons", ref: refs.identity },
      { title: "Pro Badge", desc: "Monitor your Pro Status level. Level up to get priority on high-value orders.", icon: "shield-checkmark-outline", iconType: "Ionicons", ref: refs.pro },
      { title: "Quick Actions", desc: "Easily access support, settings, and shift planning from these shortcuts.", icon: "flash-outline", iconType: "Ionicons", ref: refs.quick },
      { title: "Account Control", desc: "Manage your vehicle information, language preferences, and security settings.", icon: "settings-outline", iconType: "Ionicons", ref: refs.menu },
    ]);
  }, [tourVisible]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar style="light" />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          scrollY.current = y;
        }}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + 30 },
        ]}
        bounces={true}
      >
        <View ref={refs.identity}>
          <ProfileHeader 
            onLayout={onLayoutTarget('identity')}
            riderName={riderName}
            kycPhone={kycPhone}
            rating={rating}
            profileImage={profileImage}
            onEditPhoto={handleEditPhoto}
            onShowMenu={() => setShowMenuModal(true)}
          />
        </View>

        <View style={styles.mainContent}>
          <ProCard 
            ref={refs.pro}
            onLayout={onLayoutTarget('pro')}
          />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.quick_access')}</Text>
            <QuickActions 
              ref={refs.quick}
              onLayout={onLayoutTarget('quick')}
            />
          </View>

          <MenuList 
            ref={refs.menu}
            onLayout={onLayoutTarget('menu')}
            onShowLogout={() => setShowLogoutModal(true)}
          />

          <Text style={styles.versionTag}>
            {t("profile.version_tag", { version: "4.2.0" })}
          </Text>
        </View>
      </ScrollView>

      {/* QUICK OPTIONS MENU MODAL */}
      <Modal visible={showMenuModal} transparent={true} animationType="fade">
        <TouchableOpacity 
           style={styles.menuOverlay} 
           activeOpacity={1} 
           onPress={() => setShowMenuModal(false)}
        >
          <View style={styles.menuContent}>
            <TouchableOpacity 
              style={styles.menuOptionBtn} 
              onPress={() => { setShowMenuModal(false); router.push("/settings"); }}
            >
              <Ionicons name="settings-outline" size={20} color={COLORS.slate[700]} />
              <Text style={styles.menuOptionText}>{t("profile.settings")}</Text>
            </TouchableOpacity>
            
            <View style={styles.menuDivider} />
            
            <TouchableOpacity 
              style={styles.menuOptionBtn} 
              onPress={() => { 
                setShowMenuModal(false); 
                Alert.alert(
                  t("profile.about_alert_title"),
                  t("profile.about_alert_msg", { version: "4.2.0" })
                ); 
              }}
            >
              <Ionicons name="information-circle-outline" size={20} color={COLORS.slate[700]} />
              <Text style={styles.menuOptionText}>{t("profile.about")}</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />
            
            <TouchableOpacity 
              style={styles.menuOptionBtn} 
              onPress={() => { setShowMenuModal(false); setShowLogoutModal(true); }}
            >
              <MaterialCommunityIcons name="power" size={20} color={COLORS.error} />
              <Text style={[styles.menuOptionText, { color: COLORS.error }]}>{t("profile.logout")}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* LOGOUT MODAL */}
      <Modal visible={showLogoutModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={20}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t("profile.logout_confirm_title")}
            </Text>
            <Text style={styles.modalSub}>
              {t("profile.logout_confirm_sub")}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.cancelText}>
                  {t("common.cancel").toUpperCase()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleLogout}
              >
                <Text style={styles.confirmText}>
                  {t("profile.logout").toUpperCase()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.slate[50],
  },
  scrollContent: {
    paddingTop: 0,
  },
  mainContent: {
    paddingHorizontal: SPACING.l,
  },
  menuSection: { marginBottom: SPACING.l },
  section: { marginBottom: SPACING.l },
  sectionLabel: {
    ...TYPOGRAPHY.tag,
    color: COLORS.slate[500],
    marginBottom: SPACING.m,
    marginLeft: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  versionTag: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.slate[400],
    marginTop: SPACING.m,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    backgroundColor: '#FFF',
    width: '80%',
    borderRadius: 20,
    padding: 10,
    ...SHADOWS.medium,
  },
  menuOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    gap: 12,
  },
  menuOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.slate[700],
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.slate[50],
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "#FFF",
    borderRadius: 30,
    padding: 30,
    alignItems: "center",
    ...SHADOWS.high,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: "center",
    marginBottom: 10,
  },
  modalSub: {
    fontSize: 14,
    color: COLORS.slate[500],
    textAlign: "center",
    marginBottom: 30,
  },
  modalActions: {
    flexDirection: "row",
    gap: 15,
  },
  cancelBtn: {
    flex: 1,
    height: 55,
    borderRadius: 18,
    backgroundColor: COLORS.slate[100],
    justifyContent: "center",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate[600],
  },
  confirmBtn: {
    flex: 1,
    height: 55,
    borderRadius: 18,
    backgroundColor: COLORS.error,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmText: {
    fontSize: 12,
    fontWeight: '700',
    color: "#FFF",
  },
});
