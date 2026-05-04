import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  BackHandler,
  Image,
  Animated
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback, memo, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING, RADIUS } from '@/shared/theme';
import { ms, vs } from '@/shared/utils/responsive';
import { Button } from '@/shared/components/ui/Button';
import { kycService } from '@/services/api/features/kyc';
import { Alert } from 'react-native';

export default function KYCHub() {
  const router = useRouter();
  const { t } = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [docStatuses, setDocStatuses] = useState({
    personal: false,
    documents: false,
    category: { done: false, type: '' }
  });

  const checkStatus = async () => {
    try {
      const personal = await AsyncStorage.getItem('@personal_data');
      const docs = await AsyncStorage.getItem('@document_verification_data');
      const cat = await AsyncStorage.getItem('@kyc_subcategory');
      
      let catDone = false;
      if (cat === 'professional') {
        catDone = true;
      } else if (cat === 'student') {
        const studentData = await AsyncStorage.getItem('@student_data');
        if (studentData) {
          const parsed = JSON.parse(studentData);
          catDone = !!parsed.completed;
        }
      } else if (cat === 'disabled') {
        const disabledData = await AsyncStorage.getItem('@disabled_data');
        if (disabledData) {
          const parsed = JSON.parse(disabledData);
          catDone = !!parsed.completed;
        }
      }

      setDocStatuses({
        personal: !!personal,
        documents: !!docs,
        category: { done: catDone, type: cat || '' }
      });
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      checkStatus();
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
      ]).start();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      const backAction = () => { router.back(); return true; };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }, [router])
  );

  const isPersonalDone = docStatuses.personal;
  const isDocsDone = docStatuses.documents;
  const isCategoryDone = docStatuses.category.done;
  const completedSteps = [isPersonalDone, isDocsDone, isCategoryDone].filter(Boolean).length;
  const totalSteps = 3;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);
  const isAllDone = completedSteps === totalSteps;

  const DocCard = ({ icon, title, sub, status, onPress }: any) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, status ? styles.iconSuccess : styles.iconPending]}>
        <MaterialCommunityIcons 
          name={icon} 
          size={24} 
          color={status ? '#10B981' : COLORS.primary} 
        />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={[styles.cardSub, status && { color: '#10B981' }]}>{sub}</Text>
      </View>
      <Ionicons 
        name={status ? "checkmark-circle" : "chevron-forward"} 
        size={22} 
        color={status ? '#10B981' : COLORS.slate[300]} 
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <LinearGradient colors={['#1800ad', '#2563EB']} style={StyleSheet.absoluteFillObject} />
          <SafeAreaView edges={['top']} style={styles.heroContent}>
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>KYC HUB</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.progressSection}>
              <View style={styles.progressInfo}>
                <View>
                  <Text style={styles.progressLabel}>Verification Progress</Text>
                  <Text style={styles.progressCount}>{isAllDone ? 'Verified' : 'In Progress'}</Text>
                </View>
                <View style={styles.percentageBox}>
                  <Text style={styles.percentageText}>{progressPercent}%</Text>
                </View>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>
          </SafeAreaView>
        </View>

        <Animated.View style={[styles.body, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.sectionTitle}>REQUIRED DOCUMENTS</Text>
          
          <DocCard 
            icon="account-details-outline" 
            title="Personal Information" 
            sub={isPersonalDone ? "Verified" : "Requires basic details"} 
            status={isPersonalDone}
            onPress={() => router.push('/kyc/personal')}
          />

          <DocCard 
            icon="file-document-outline" 
            title="Identity Documents" 
            sub={isDocsDone ? "Verified" : "Requires documentation"} 
            status={isDocsDone}
            onPress={() => router.push('/kyc/document-verification')}
          />

          <DocCard 
            icon="briefcase-outline" 
            title="Employment Category" 
            sub={isCategoryDone ? (docStatuses.category.type === 'student' ? 'Student Verified' : docStatuses.category.type === 'disabled' ? 'Disabled Verified' : 'Verified') : 'Select work profile'} 
            status={isCategoryDone}
            onPress={() => router.push('/kyc/category')}
          />

          <View style={styles.infoBox}>
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>
              Your data is encrypted and stored securely according to RBI guidelines.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, !isAllDone && styles.submitBtnDisabled]}
          disabled={!isAllDone}
          onPress={async () => {
            try {
              const next = await kycService.finalize();
              if (next.status === 'verified' || next.status === 'under_review') {
                router.replace('/(tabs)/home');
              } else {
                Alert.alert('Submission incomplete', 'Some KYC steps are still pending.');
              }
            } catch (e: unknown) {
              const msg = (e as { message?: string } | undefined)?.message ?? 'Could not submit KYC';
              Alert.alert('Verification failed', msg);
            }
          }}
        >
          <LinearGradient
            colors={['#1800ad', '#2563EB']}
            style={styles.btnGradient}
          >
            <Text style={styles.btnText}>FINALIZE VERIFICATION</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingBottom: vs(120) },
  heroSection: { borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl, overflow: 'hidden', paddingBottom: 30 },
  heroContent: { paddingHorizontal: SPACING.l },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.m },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  progressSection: { marginTop: vs(30) },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  progressLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },
  progressCount: { color: '#FFF', fontSize: 20, fontWeight: '900', marginTop: 2 },
  percentageBox: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  percentageText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  progressBarBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 4 },
  body: { padding: SPACING.l, marginTop: -20 },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: COLORS.slate[400], letterSpacing: 1.5, marginBottom: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: RADIUS.xl, marginBottom: 12, ...SHADOWS.soft, borderWidth: 1, borderColor: '#EDF2F7' },
  iconContainer: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  iconSuccess: { backgroundColor: '#10B98115' },
  iconPending: { backgroundColor: COLORS.primary + '10' },
  cardContent: { flex: 1, marginLeft: 16 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.slate[800] },
  cardSub: { fontSize: 12, color: '#10B981', fontWeight: '600', marginTop: 2 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.primary + '08', padding: 16, borderRadius: RADIUS.lg, marginTop: 10 },
  infoText: { flex: 1, fontSize: 12, color: COLORS.slate[600], lineHeight: 18 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.l, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#EDF2F7' },
  submitBtn: { height: 56, borderRadius: RADIUS.xl, overflow: 'hidden', ...SHADOWS.medium },
  submitBtnDisabled: { opacity: 0.6 },
  btnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});
