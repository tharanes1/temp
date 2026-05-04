import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  BackHandler,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING, RADIUS } from '@/shared/theme';
import { vs, ms } from '@/shared/utils/responsive';

type MainCategory = 'freelancer' | 'fulltime' | null;
type SubCategory = 'student' | 'professional' | 'disabled' | null;

export default function CategoryScreen() {
  const router = useRouter();
  const [mainCat, setMainCat] = useState<MainCategory>(null);
  const [subCat, setSubCat] = useState<SubCategory>(null);
  const [saveState, setSaveState] = useState<'idle' | 'loading' | 'success'>('idle');
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start();

    const loadSelection = async () => {
      const savedMain = await AsyncStorage.getItem('@kyc_category');
      const savedSub = await AsyncStorage.getItem('@kyc_subcategory');
      if (savedMain) setMainCat(savedMain as MainCategory);
      if (savedSub) setSubCat(savedSub as SubCategory);
    };
    loadSelection();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const backAction = () => { router.back(); return true; };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }, [router])
  );

  const handleSave = async () => {
    if (!mainCat || !subCat) return;
    setSaveState('loading');

    // Persist locally for offline cold-starts.
    await AsyncStorage.setItem('@kyc_category', mainCat);
    await AsyncStorage.setItem('@kyc_subcategory', subCat);

    // Server-side persistence (locked A4 — two-axis category).
    try {
      const { kycService } = await import('@/services/api/features/kyc');
      await kycService.setCategory({
        category: mainCat as 'freelancer' | 'fulltime',
        subCategory: subCat as 'student' | 'professional' | 'disabled',
      });
    } catch (e: unknown) {
      setSaveState('error');
      const msg = (e as { message?: string } | undefined)?.message ?? 'Could not save category';
      Alert.alert('Save failed', msg);
      return;
    }

    setSaveState('success');

    // Scenario Handling
    setTimeout(() => {
      if (subCat === 'student') {
        router.push('/kyc/student');
      } else if (subCat === 'disabled') {
        router.push('/kyc/disabled');
      } else {
        router.back(); // Working Professional goes back to Hub
      }
    }, 800);
  };

  const OptionCard = ({ active, title, sub, icon, onPress }: any) => (
    <TouchableOpacity 
      style={[styles.mattePanel, active && styles.panelActive]} 
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={[styles.iconBox, active && styles.iconBoxActive]}>
        <MaterialCommunityIcons name={icon} size={28} color={active ? '#FFF' : COLORS.primary} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>{title}</Text>
        <Text style={styles.cardSub}>{sub}</Text>
      </View>
      <View style={[styles.radio, active && styles.radioActive]}>
        {active && <View style={styles.radioInner} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={styles.heroSection}>
            <LinearGradient colors={['#1800ad', '#2563EB']} style={StyleSheet.absoluteFillObject} />
            <SafeAreaView edges={['top']} style={styles.heroContent}>
              <View style={styles.heroHeader}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                  <Ionicons name="chevron-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.securityTag}>
                  <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                  <Text style={styles.securityText}>STRATEGY MODULE</Text>
                </View>
              </View>

              <View style={styles.heroBody}>
                <View style={styles.heroMainRow}>
                  <View style={styles.heroIconBox}><MaterialCommunityIcons name="account-group-outline" size={32} color="#FFF" /></View>
                  <View style={styles.heroText}>
                    <Text style={styles.heroTitle}>Employment Hub</Text>
                    <Text style={styles.heroSubtitle}>Classify your professional profile</Text>
                  </View>
                </View>
                <View style={styles.progressContainer}>
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.progressLabel}>HUB PROGRESS</Text>
                    <Text style={styles.progressValue}>{mainCat ? (subCat ? '100%' : '50%') : '0%'}</Text>
                  </View>
                  <View style={styles.progressBarBase}>
                    <View style={[styles.progressBarFill, { width: mainCat ? (subCat ? '100%' : '50%') : '5%' }]} />
                  </View>
                </View>
              </View>
            </SafeAreaView>
          </View>

          <View style={styles.contentWrapper}>
            {!mainCat ? (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>SELECT WORK MODEL</Text>
                  <View style={styles.divider} />
                </View>
                <OptionCard 
                  active={mainCat === 'freelancer'} 
                  title="FREELANCER" 
                  sub="Flexible shifts and autonomy." 
                  icon="bike-fast" 
                  onPress={() => setMainCat('freelancer')} 
                />
                <OptionCard 
                  active={mainCat === 'fulltime'} 
                  title="FULL TIME" 
                  sub="Guaranteed hours and salary." 
                  icon="briefcase-clock-outline" 
                  onPress={() => setMainCat('fulltime')} 
                />
              </View>
            ) : (
              <View>
                <View style={styles.sectionHeader}>
                  <TouchableOpacity onPress={() => { setMainCat(null); setSubCat(null); }} style={styles.backToMain}>
                    <Ionicons name="arrow-back" size={14} color={COLORS.primary} />
                    <Text style={styles.backToMainText}>CHANGE MODEL</Text>
                  </TouchableOpacity>
                  <View style={styles.divider} />
                </View>

                <View style={styles.selectionInfo}>
                   <Text style={styles.selectionLabel}>SELECTED MODEL:</Text>
                   <Text style={styles.selectionValue}>{mainCat.toUpperCase()}</Text>
                </View>

                <View style={[styles.sectionHeader, { marginTop: 20 }]}>
                  <Text style={styles.sectionTitle}>YOUR STATUS</Text>
                  <View style={styles.divider} />
                </View>

                <OptionCard 
                  active={subCat === 'student'} 
                  title="STUDENT" 
                  sub="Requires college verification details." 
                  icon="school" 
                  onPress={() => setSubCat('student')} 
                />
                <OptionCard 
                  active={subCat === 'professional'} 
                  title="WORKING PROFESSIONAL" 
                  sub="Standard employment model." 
                  icon="account-tie" 
                  onPress={() => setSubCat('professional')} 
                />
                <OptionCard 
                  active={subCat === 'disabled'} 
                  title="PERSON WITH DISABILITY" 
                  sub="Requires disability certificate details." 
                  icon="wheelchair-accessibility" 
                  onPress={() => setSubCat('disabled')} 
                />

                <TouchableOpacity 
                  style={[styles.primaryCTA, !subCat && styles.primaryCTADisabled]} 
                  onPress={handleSave}
                  disabled={!subCat || saveState === 'loading'}
                >
                  <LinearGradient colors={['#1800ad', '#2563EB']} style={styles.ctaGradient}>
                    {saveState === 'loading' ? <ActivityIndicator color="#FFF" /> : (
                      <><Text style={styles.ctaText}>PROCEED TO VERIFICATION</Text><Ionicons name="arrow-forward-circle" size={22} color="#FFF" /></>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingBottom: vs(100) },
  heroSection: { height: vs(240), backgroundColor: '#1800ad', borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl, overflow: 'hidden' },
  heroContent: { flex: 1, paddingHorizontal: SPACING.l },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.m },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  securityTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  securityText: { fontSize: 9, fontWeight: '900', color: '#10B981', letterSpacing: 1 },
  heroBody: { marginTop: vs(25) },
  heroMainRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroIconBox: { width: 64, height: 64, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  heroText: { flex: 1 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  heroSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 2 },
  progressContainer: { marginTop: vs(20) },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.8)', letterSpacing: 1 },
  progressValue: { fontSize: 11, fontWeight: '900', color: '#FFF' },
  progressBarBase: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 3 },
  contentWrapper: { paddingHorizontal: SPACING.l, marginTop: vs(20) },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: COLORS.slate[400], letterSpacing: 1 },
  divider: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  
  backToMain: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary + '08', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  backToMainText: { fontSize: 10, fontWeight: '900', color: COLORS.primary },
  
  selectionInfo: { padding: 16, backgroundColor: COLORS.slate[50], borderRadius: RADIUS.lg, marginTop: 10, borderWidth: 1, borderColor: '#EDF2F7' },
  selectionLabel: { fontSize: 9, fontWeight: '900', color: COLORS.slate[400], letterSpacing: 1 },
  selectionValue: { fontSize: 16, fontWeight: '900', color: COLORS.slate[800], marginTop: 4 },

  mattePanel: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: RADIUS.xl, padding: SPACING.m, marginBottom: SPACING.s, ...SHADOWS.soft, borderWidth: 1, borderColor: '#EDF2F7' },
  panelActive: { borderColor: COLORS.primary, backgroundColor: '#FFF', ...SHADOWS.medium },
  iconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  iconBoxActive: { backgroundColor: COLORS.primary },
  cardInfo: { flex: 1, marginLeft: 16 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: COLORS.slate[800] },
  cardTitleActive: { color: COLORS.primary },
  cardSub: { fontSize: 11, color: COLORS.slate[500], fontWeight: '600', marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  primaryCTA: { height: 60, borderRadius: RADIUS.xl, overflow: 'hidden', marginTop: SPACING.l, ...SHADOWS.medium },
  primaryCTADisabled: { opacity: 0.6 },
  ctaGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  ctaText: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
});
