import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions,
  Image,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { riderService, type VehicleInfo } from '@/services/api/features/rider';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { useTranslation } from 'react-i18next';
import Animated, { 
  FadeInDown, 
  FadeInRight,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

export default function VehicleInformation() {
  const router = useRouter();
  const { t } = useTranslation();
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Theme support
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const { darkMode } = useSettings();
  const isDark = darkMode;

  // Animation for scanner
  const scanAnim = useSharedValue(0);

  useEffect(() => {
    scanAnim.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );

    const loadData = async () => {
      try {
        // Source of truth — GET /rider/vehicle. Replaces the legacy reads of
        // @license_data / @kyc_license_image / @vehicle_data / @kyc_rc_image
        // that were never written by any screen.
        const v = await riderService.getVehicle();
        setVehicle(v);
      } catch (e: unknown) {
        const msg = (e as { message?: string } | undefined)?.message ?? 'Failed to load vehicle';
        setLoadError(msg);
      } finally {
        // Small delay to avoid a flash of the loading state on fast networks.
        setTimeout(() => setLoading(false), 400);
      }
    };
    void loadData();
  }, []);

  const animatedScanStyle = useAnimatedStyle(() => ({
    top: scanAnim.value * 220,
    opacity: 1 - Math.abs(scanAnim.value - 0.5) * 2,
  }));

  const EliteVehicleCard = ({ label, image, number, icon, type, onEdit }: any) => (
    <Animated.View entering={FadeInDown.delay(200)} layout={Layout} style={[styles.eliteVehicleCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
       <View style={styles.vCardHeader}>
          <View style={styles.vCardTitleRow}>
             <View style={[styles.vCardIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                <MaterialCommunityIcons name={icon} size={22} color={PRIMARY_BLUE} />
             </View>
             <View>
                <Text style={[styles.vCardSubtitle, { color: subtextColor }]}>{type}</Text>
                <Text style={[styles.vCardTitle, { color: textColor }]}>{label}</Text>
             </View>
          </View>
          <TouchableOpacity style={styles.vEditBtn} onPress={onEdit}>
             <Ionicons name="pencil" size={16} color={PRIMARY_BLUE} />
          </TouchableOpacity>
       </View>

       <View style={styles.vIdContainer}>
          <View style={styles.vIdBox}>
             <Text style={[styles.vIdLabel, { color: subtextColor }]}>REGISTERED NUMBER</Text>
             <Text style={[styles.vIdValue, { color: textColor }]}>{number || 'Not Linked'}</Text>
          </View>
          <View style={styles.vStatusTag}>
             <Ionicons name="checkmark-circle" size={14} color="#FFF" />
             <Text style={styles.vStatusText}>ACTIVE</Text>
          </View>
       </View>

       <View style={styles.vPreviewArea}>
          {image ? (
            <>
              <Image source={{ uri: image }} style={styles.vImage} resizeMode="cover" />
              <BlurView intensity={30} style={styles.vScanOverlay}>
                 <Animated.View style={[styles.vScanLine, animatedScanStyle]} />
              </BlurView>
            </>
          ) : (
            <View style={styles.vEmptyState}>
               <FontAwesome5 name="car-side" size={40} color={subtextColor} opacity={0.2} />
               <Text style={[styles.vEmptyText, { color: subtextColor }]}>Pending Verification</Text>
            </View>
          )}
       </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: bgColor }]}>
        <ActivityIndicator size="large" color={PRIMARY_BLUE} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* 🏎️ ELITE HEADER */}
      <View style={styles.headerHero}>
        <LinearGradient
          colors={['#1800ad', '#2563EB']}
          style={styles.headerGradient}
        />
        <View style={styles.headerDecoration}>
           <View style={styles.glowOrb} />
        </View>

        <SafeAreaView edges={['top']} style={styles.headerContent}>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerTitleBox}>
               <Text style={styles.headerTag}>FLEET ASSETS</Text>
               <Text style={styles.headerTitle}>{t('vehicle_info.title')}</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/kyc/document-verification')}>
               <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mainContent}>
          
          <EliteVehicleCard
             label={t('vehicle_info.driving_license')}
             type="OPERATOR CREDENTIALS"
             number={vehicle?.registrationNumber ?? null}
             image={vehicle?.bikePhoto ?? null}
             icon="card-account-details-outline"
             onEdit={() => router.push('/kyc/document-verification')}
          />

          <EliteVehicleCard
             label={t('vehicle_info.rc_section')}
             type="VEHICLE REGISTRATION"
             number={vehicle?.registrationNumber ?? null}
             image={vehicle?.rcImage ?? null}
             icon="motorbike"
             onEdit={() => router.push('/kyc/document-verification')}
          />

          {loadError ? (
            <Text style={[styles.footerNote, { color: subtextColor, marginTop: 6 }]}>
              {loadError}
            </Text>
          ) : null}

          <View style={styles.fleetFooter}>
             <View style={styles.footerBadge}>
                <MaterialCommunityIcons name="check-decagram" size={18} color="#10B981" />
                <Text style={styles.footerBadgeText}>FLEET VERIFIED</Text>
             </View>
             <Text style={[styles.footerNote, { color: subtextColor }]}>
                Vehicle documents are cross-verified with RTO database.
             </Text>
          </View>
        </View>
      </ScrollView>
          </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerHero: { backgroundColor: PRIMARY_BLUE, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden', paddingBottom: 30 },
  headerGradient: { ...StyleSheet.absoluteFillObject },
  headerDecoration: { ...StyleSheet.absoluteFillObject },
  glowOrb: { position: 'absolute', top: -50, right: -50, width: 250, height: 250, borderRadius: 125, backgroundColor: '#3B82F6', opacity: 0.1 },
  headerContent: { paddingHorizontal: 25 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  headerTitleBox: { alignItems: 'center' },
  headerTag: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.5)', letterSpacing: 2 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 40 },
  mainContent: { paddingHorizontal: 20, marginTop: 25 },
  eliteVehicleCard: { borderRadius: 32, padding: 24, marginBottom: 25, borderWidth: 1, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24 },
  vCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25 },
  vCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  vCardIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  vCardSubtitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  vCardTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  vEditBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(24, 0, 173, 0.05)', justifyContent: 'center', alignItems: 'center' },
  vIdContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, backgroundColor: 'rgba(0,0,0,0.02)', padding: 16, borderRadius: 20 },
  vIdBox: { gap: 4 },
  vIdLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  vIdValue: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  vStatusTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  vStatusText: { fontSize: 10, fontWeight: '900', color: '#FFF' },
  vPreviewArea: { height: 220, borderRadius: 28, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.02)', position: 'relative' },
  vImage: { width: '100%', height: '100%' },
  vScanOverlay: { ...StyleSheet.absoluteFillObject },
  vScanLine: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: '#10B981', shadowColor: '#10B981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10 },
  vEmptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  vEmptyText: { fontSize: 12, fontWeight: '800' },
  fleetFooter: { marginTop: 10, alignItems: 'center', gap: 12 },
  footerBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(16, 185, 129, 0.05)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  footerBadgeText: { fontSize: 12, fontWeight: '900', color: '#10B981', letterSpacing: 1 },
  footerNote: { fontSize: 11, fontWeight: '700', textAlign: 'center', opacity: 0.5, lineHeight: 16 },
});
