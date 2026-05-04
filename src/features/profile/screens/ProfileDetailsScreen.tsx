import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions, 
  Platform,
  ActivityIndicator,
  Image
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/core/providers/UserContext';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import Animated, { 
  FadeInDown, 
  FadeInRight, 
  Layout, 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

export default function ProfileDetails() {
  const router = useRouter();
  const { t } = useTranslation();

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.back();
        return true;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );

      return () => subscription.remove();
    }, [router])
  );
  const { riderName, profileImage } = useUser();
  const [personalData, setPersonalData] = useState<any>(null);
  const [studentData, setStudentData] = useState<any>(null);
  const [disabledData, setDisabledData] = useState<any>(null);
  const [userCategory, setUserCategory] = useState<'standard' | 'student' | 'disabled'>('standard');
  const [loading, setLoading] = useState(true);

  // Animation values
  const avatarGlow = useSharedValue(1);

  // Theme support
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const { darkMode } = useSettings();
  const isDark = darkMode;

  useEffect(() => {
    avatarGlow.value = withRepeat(
      withTiming(1.2, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );

    const loadAllData = async () => {
      try {
        const [savedPersonal, savedStudent, savedDisabled] = await Promise.all([
          AsyncStorage.getItem('@personal_data'),
          AsyncStorage.getItem('@student_data'),
          AsyncStorage.getItem('@disabled_data')
        ]);

        if (savedPersonal) {
          const parsed = JSON.parse(savedPersonal);
          setPersonalData(parsed);
          if (parsed.category) setUserCategory(parsed.category);
        }
        if (savedStudent) setStudentData(JSON.parse(savedStudent));
        if (savedDisabled) setDisabledData(JSON.parse(savedDisabled));
      } catch (e) {
        console.error('Data Load Error:', e);
      } finally {
        setTimeout(() => setLoading(false), 800); 
      }
    };
    loadAllData();
  }, []);

  const animatedGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarGlow.value }],
    opacity: 0.3 * (avatarGlow.value - 0.2),
  }));

  const onlineDotBorderColor = '#1800ad';

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: bgColor }]}>
        <ActivityIndicator size="large" color={PRIMARY_BLUE} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 🔴 ELITE HERO HEADER */}
        <View style={styles.headerHero}>
          <LinearGradient
            colors={['#1800ad', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          />
          <View style={styles.headerDecoration}>
             <View style={styles.glowOrb} />
             <View style={styles.meshGrid} />
          </View>

          <SafeAreaView edges={['top']} style={styles.headerContent}>
            <View style={styles.navRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <BlurView intensity={20} style={styles.statusBadge}>
                 <View style={styles.pulseDot} />
                 <Text style={styles.statusBadgeText}>IDENTITY VERIFIED</Text>
              </BlurView>
              <TouchableOpacity style={styles.settingsBtn}>
                 <MaterialCommunityIcons name="cog-outline" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Animated.View entering={FadeInDown.delay(200)} style={styles.heroMain}>
              <View style={styles.avatarWrapper}>
                <Animated.View style={[styles.glowRing, animatedGlowStyle]} />
                <View style={styles.avatarContainer}>
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.headerAvatar} />
                  ) : (
                    <View style={styles.headerAvatarPlaceholder}>
                      <Text style={styles.avatarLetter}>{riderName?.charAt(0) || 'R'}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.verifiedCheck}>
                   <Ionicons name="checkmark-sharp" size={12} color="#FFF" />
                </View>
              </View>
              
              <Text style={styles.heroTitle}>{personalData?.fullName || personalData?.name || riderName}</Text>
              <View style={styles.idBadge}>
                 <Text style={styles.idBadgeText}>ID: CRX-{personalData?.mobile?.slice(-4) || '7789'}</Text>
              </View>
              
              <View style={styles.categoryRow}>
                 <BlurView intensity={30} style={styles.categoryPill}>
                    <MaterialCommunityIcons name="shield-crown" size={14} color="#FBBF24" />
                    <Text style={styles.categoryLabel}>{userCategory.toUpperCase()} RIDER</Text>
                 </BlurView>
              </View>
            </Animated.View>
          </SafeAreaView>
        </View>

        <View style={styles.mainContent}>
          
          {/* PROFILE STATS BAR */}
          <Animated.View entering={FadeInDown.delay(400)} style={styles.statsBar}>
             <StatItem icon="star" value="4.9" label="Rating" />
             <View style={styles.statDivider} />
             <StatItem icon="bike" value="1,240" label="Trips" />
             <View style={styles.statDivider} />
             <StatItem icon="clock-outline" value="2y 4m" label="Tenure" />
          </Animated.View>

          {/* INFORMATION BLOCKS */}
          <Animated.View entering={FadeInDown.delay(500)} layout={Layout}>
             <ModernSectionCard 
                title="PERSONAL INFORMATION" 
                icon="account-outline"
                color={PRIMARY_BLUE}
                bgColor={cardColor}
                borderColor={borderColor}
                onEdit={() => router.push('/kyc/personal')}
             >
                <InfoRow label="Mobile Number" value={personalData?.mobile || '-'} />
                <InfoRow label="Email Address" value={personalData?.email || '-'} />
                <InfoRow label="Gender / Age" value={`${personalData?.gender?.toUpperCase() || '-'} • ${personalData?.age || '-'} Yrs`} />
                <InfoRow label="Blood Group" value={personalData?.bloodGroup || '-'} />
             </ModernSectionCard>
          </Animated.View>

          {userCategory === 'student' && (
            <Animated.View entering={FadeInDown.delay(600)} layout={Layout}>
               <ModernSectionCard 
                  title="ACADEMIC CREDENTIALS" 
                  icon="school-outline"
                  color="#8B5CF6"
                  bgColor={cardColor}
                  borderColor={borderColor}
                  onEdit={() => router.push('/kyc/student')}
               >
                  <InfoRow label="Institution" value={studentData?.collegeName || '-'} />
                  <InfoRow label="Course / Year" value={`${studentData?.course || '-'} • ${studentData?.yearOfStudy || '-'} Year`} />
                  <InfoRow label="Reg Number" value={studentData?.registerNumber || '-'} />
               </ModernSectionCard>
            </Animated.View>
          )}

          {userCategory === 'disabled' && (
            <Animated.View entering={FadeInDown.delay(600)} layout={Layout}>
               <ModernSectionCard 
                  title="INCLUSION PROFILE" 
                  icon="human-wheelchair"
                  color="#EF4444"
                  bgColor={cardColor}
                  borderColor={borderColor}
                  onEdit={() => router.push('/kyc/disabled')}
               >
                  <InfoRow label="Certificate ID" value={disabledData?.certificateNumber || disabledData?.certNumber || '-'} />
                  <InfoRow label="Disability Type" value={disabledData?.disabilityType || '-'} />
                  <InfoRow label="Intensity" value={disabledData?.percentage ? `${disabledData.percentage}%` : '-'} />
                  <InfoRow label="Issuing Authority" value={disabledData?.issuingAuthority || '-'} />
                  <InfoRow label="Guardian Name" value={disabledData?.guardianName || '-'} />
                  <InfoRow label="Guardian Mobile" value={disabledData?.guardianMobile || '-'} />
               </ModernSectionCard>
            </Animated.View>
          )}

          <View style={styles.footerNote}>
             <MaterialCommunityIcons name="shield-lock-outline" size={16} color="#94A3B8" />
             <Text style={[styles.footerText, { color: subtextColor }]}>End-to-end encrypted biometric profile</Text>
          </View>
        </View>
      </ScrollView>
          </View>
  );
}

function StatItem({ icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <View style={styles.statItem}>
       <MaterialCommunityIcons name={icon} size={20} color={PRIMARY_BLUE} />
       <Text style={styles.statValue}>{value}</Text>
       <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ModernSectionCard({ title, icon, color, children, bgColor, borderColor, onEdit }: any) {
  return (
    <View style={[styles.modernCard, { backgroundColor: bgColor, borderColor: borderColor }]}>
       <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
             <View style={[styles.iconHole, { backgroundColor: color + '15' }]}>
                <MaterialCommunityIcons name={icon} size={20} color={color} />
             </View>
             <Text style={[styles.cardTitle, { color: '#64748B' }]}>{title}</Text>
          </View>
          <TouchableOpacity onPress={onEdit}>
             <Ionicons name="create-outline" size={20} color={color} />
          </TouchableOpacity>
       </View>
       <View style={styles.cardBody}>
          {children}
       </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
       <Text style={styles.infoRowLabel}>{label}</Text>
       <Text style={styles.infoRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerHero: { 
    borderBottomLeftRadius: 40, 
    borderBottomRightRadius: 40, 
    overflow: 'hidden',
    paddingBottom: 40,
    backgroundColor: PRIMARY_BLUE,
  },
  headerGradient: { ...StyleSheet.absoluteFillObject },
  headerDecoration: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  glowOrb: { position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: '#3B82F6', opacity: 0.15 },
  meshGrid: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.03 }, // Use a pattern if needed
  headerContent: { paddingHorizontal: 25 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' },
  statusBadgeText: { fontSize: 10, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  settingsBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  heroMain: { marginTop: 20, alignItems: 'center' },
  avatarWrapper: { marginBottom: 20, position: 'relative', width: 120, height: 120, justifyContent: 'center', alignItems: 'center' },
  glowRing: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#3B82F6' },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, overflow: 'hidden', borderWidth: 3, borderColor: '#FFF' },
  headerAvatar: { width: '100%', height: '100%' },
  headerAvatarPlaceholder: { flex: 1, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontSize: 40, fontWeight: '900', color: '#FFF' },
  verifiedCheck: { position: 'absolute', bottom: 10, right: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#1800ad' },
  heroTitle: { fontSize: 32, fontWeight: '900', color: '#FFF', letterSpacing: -1 },
  idBadge: { marginTop: 4, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.05)' },
  idBadgeText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1 },
  categoryRow: { marginTop: 15 },
  categoryPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  categoryLabel: { fontSize: 12, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
  scrollContent: { paddingBottom: 60 },
  mainContent: { paddingHorizontal: 20, marginTop: -30 },
  statsBar: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 24, paddingVertical: 20, marginBottom: 25, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15 },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
  statDivider: { width: 1, height: '60%', backgroundColor: '#F1F5F9' },
  modernCard: { borderRadius: 28, padding: 24, marginBottom: 20, borderWidth: 1, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconHole: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  cardBody: { gap: 18 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoRowLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  infoRowValue: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  footerNote: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10, opacity: 0.4 },
  footerText: { fontSize: 11, fontWeight: '700' },
});
