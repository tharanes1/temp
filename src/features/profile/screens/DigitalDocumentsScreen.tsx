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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { useTranslation } from 'react-i18next';
import Animated, { 
  FadeInDown, 
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

export default function DigitalDocuments() {
  const router = useRouter();
  const { t } = useTranslation();
  const [aadhaarData, setAadhaarData] = useState<any>(null);
  const [aadhaarFront, setAadhaarFront] = useState<string | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<string | null>(null);
  const [insuranceData, setInsuranceData] = useState<any>(null);
  const [insuranceImage, setInsuranceImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Theme support
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const { darkMode } = useSettings();
  const isDark = darkMode;

  // Shimmer animation
  const shimmerPos = useSharedValue(-width);

  useEffect(() => {
    shimmerPos.value = withRepeat(
      withTiming(width, { duration: 2500, easing: Easing.linear }),
      -1,
      false
    );

    const loadData = async () => {
      try {
        // Source of truth: GET /api/v1/support/documents (composes Rider + KYC
        // + Vehicle).  Replaces the legacy reads of @aadhaar_data /
        // @kyc_aadhaar_front / @kyc_aadhaar_back / @insurance_data /
        // @kyc_insurance_image — review §6.2 #7 flagged that those keys were
        // never written, so the screen always rendered "Pending Upload".
        const { supportService } = await import('@/services/api/features/support');
        const docs = await supportService.listDocuments();
        const aadhaar = docs.find((d) => d.type === 'aadhaar');
        const insurance = docs.find((d) => d.type === 'insurance');
        if (aadhaar?.downloadUrl) {
          setAadhaarFront(aadhaar.downloadUrl);
          setAadhaarData({ status: aadhaar.status });
        }
        if (insurance?.downloadUrl) {
          setInsuranceImage(insurance.downloadUrl);
          setInsuranceData({
            status: insurance.status,
            expiresAt: insurance.expiresAt,
          });
        }
      } catch (e) {
        if (__DEV__) console.warn('Documents load failed:', (e as Error).message);
      } finally {
        setTimeout(() => setLoading(false), 400);
      }
    };
    loadData();
  }, []);

  const animatedShimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerPos.value }],
  }));

  const PremiumDocCard = ({ label, image, icon, subtitle }: { label: string, image: string | null, icon: any, subtitle: string }) => (
    <View style={styles.docWrapper}>
      <View style={styles.docLabelRow}>
         <Text style={[styles.docLabelTitle, { color: textColor }]}>{label}</Text>
         <Text style={[styles.docLabelSub, { color: subtextColor }]}>{subtitle}</Text>
      </View>
      <TouchableOpacity activeOpacity={0.9} style={[styles.premiumPreviewBox, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: borderColor }]}>
        {image ? (
          <>
            <Image source={{ uri: image }} style={styles.docImage} resizeMode="cover" />
            <Animated.View style={[styles.shimmerLayer, animatedShimmerStyle]}>
               <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.2)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
               />
            </Animated.View>
            <BlurView intensity={40} style={styles.docVerifiedBadge}>
               <MaterialCommunityIcons name="check-decagram" size={14} color="#4ADE80" />
               <Text style={styles.docVerifiedText}>SECURE ACCESS</Text>
            </BlurView>
          </>
        ) : (
          <View style={styles.emptyDocState}>
            <View style={styles.emptyIconCircle}>
               <Ionicons name={icon} size={32} color={PRIMARY_BLUE} opacity={0.3} />
            </View>
            <Text style={[styles.emptyDocText, { color: subtextColor }]}>Pending Upload</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
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
      {/* 🌌 ELITE HEADER */}
      <View style={styles.headerHero}>
        <LinearGradient
          colors={['#1800ad', '#2563EB']}
          style={styles.headerGradient}
        />
        <View style={styles.headerDecor}>
           <View style={styles.decorCircle} />
           <View style={styles.decorGrid} />
        </View>

        <SafeAreaView edges={['top']} style={styles.headerContent}>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
               <Text style={styles.headerSub}>DIGITAL VAULT</Text>
               <Text style={styles.headerTitle}>Compliance Hub</Text>
            </View>
            <TouchableOpacity style={styles.helpBtn}>
               <Ionicons name="help-circle-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mainContent}>
          
          {/* AADHAAR VAULT */}
          <Animated.View entering={FadeInDown.delay(200)} style={[styles.eliteSection, { backgroundColor: cardColor, borderColor: borderColor }]}>
             <View style={styles.sectionHeadingRow}>
                <View style={styles.headingTitleRow}>
                   <View style={styles.headingIcon}>
                      <MaterialCommunityIcons name="card-account-details" size={20} color={PRIMARY_BLUE} />
                   </View>
                   <Text style={[styles.headingText, { color: subtextColor }]}>GOVERNMENT IDENTITY</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/kyc/aadhaar')}>
                   <Text style={styles.manageText}>MANAGE</Text>
                </TouchableOpacity>
             </View>

             <View style={styles.idDisplay}>
                <Text style={[styles.idNum, { color: textColor }]}>{aadhaarData?.number || 'XXXX-XXXX-XXXX'}</Text>
                <View style={styles.idActivePill}>
                   <View style={styles.activeDot} />
                   <Text style={styles.activeText}>VERIFIED</Text>
                </View>
             </View>

             <View style={styles.docGrid}>
                <PremiumDocCard label="Front Side" image={aadhaarFront} icon="id-card-outline" subtitle="Aadhaar Card" />
                <PremiumDocCard label="Back Side" image={aadhaarBack} icon="id-card-outline" subtitle="Aadhaar Card" />
             </View>
          </Animated.View>

          {/* INSURANCE VAULT */}
          <Animated.View entering={FadeInDown.delay(400)} style={[styles.eliteSection, { backgroundColor: cardColor, borderColor: borderColor }]}>
             <View style={styles.sectionHeadingRow}>
                <View style={styles.headingTitleRow}>
                   <View style={[styles.headingIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                      <MaterialCommunityIcons name="shield-check" size={20} color="#10B981" />
                   </View>
                   <Text style={[styles.headingText, { color: subtextColor }]}>PROTECTION & SAFETY</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/kyc/insurance')}>
                   <Text style={[styles.manageText, { color: '#10B981' }]}>RENEW</Text>
                </TouchableOpacity>
             </View>

             <View style={styles.idDisplay}>
                <Text style={[styles.idNum, { color: textColor }]}>{insuranceData?.number || 'POL-XXXXXXXX'}</Text>
                <Text style={styles.expiryTag}>Expires in 240 days</Text>
             </View>

             <PremiumDocCard label="Policy Document" image={insuranceImage} icon="shield-outline" subtitle="Vehicle Insurance" />
          </Animated.View>

          <View style={styles.secureFooter}>
             <Ionicons name="shield-checkmark" size={16} color="#4ADE80" />
             <Text style={[styles.secureText, { color: subtextColor }]}>All documents are hosted on encrypted decentralized storage.</Text>
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
  headerDecor: { ...StyleSheet.absoluteFillObject },
  decorCircle: { position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: '#3B82F6', opacity: 0.1 },
  decorGrid: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },
  headerContent: { paddingHorizontal: 25 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  headerTitleContainer: { alignItems: 'center' },
  headerSub: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.5)', letterSpacing: 2 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  helpBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 40 },
  mainContent: { paddingHorizontal: 20, marginTop: 25 },
  eliteSection: { borderRadius: 32, padding: 24, marginBottom: 25, borderWidth: 1, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20 },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(24, 0, 173, 0.06)', justifyContent: 'center', alignItems: 'center' },
  headingText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  manageText: { fontSize: 11, fontWeight: '900', color: PRIMARY_BLUE },
  idDisplay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, backgroundColor: 'rgba(0,0,0,0.02)', padding: 16, borderRadius: 16 },
  idNum: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  idActivePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  activeText: { fontSize: 9, fontWeight: '900', color: '#10B981' },
  expiryTag: { fontSize: 10, fontWeight: '800', color: '#EAB308' },
  docGrid: { flexDirection: 'row', gap: 16 },
  docWrapper: { flex: 1 },
  docLabelRow: { marginBottom: 10 },
  docLabelTitle: { fontSize: 12, fontWeight: '800' },
  docLabelSub: { fontSize: 9, fontWeight: '700', opacity: 0.7 },
  premiumPreviewBox: { height: 140, borderRadius: 20, overflow: 'hidden', borderWidth: 1, position: 'relative' },
  docImage: { width: '100%', height: '100%' },
  shimmerLayer: { ...StyleSheet.absoluteFillObject, width: '200%' },
  docVerifiedBadge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 5, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  docVerifiedText: { fontSize: 8, fontWeight: '900', color: '#FFF' },
  emptyDocState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0,0,0,0.03)', justifyContent: 'center', alignItems: 'center' },
  emptyDocText: { fontSize: 10, fontWeight: '800' },
  secureFooter: { marginTop: 15, paddingHorizontal: 20, alignItems: 'center', gap: 8 },
  secureText: { fontSize: 11, fontWeight: '700', textAlign: 'center', opacity: 0.5 },
});
