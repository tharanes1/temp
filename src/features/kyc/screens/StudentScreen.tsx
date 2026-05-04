import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Animated, 
  BackHandler, 
  ActivityIndicator,
  Image
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SHADOWS, SPACING, RADIUS } from '@/shared/theme';
import { vs, ms } from '@/shared/utils/responsive';
import { Input } from '@/shared/components/ui/Input';

export default function StudentDetailsScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    collegeName: '',
    department: '',
    courseName: '',
    duration: '',
    registerNumber: '',
    graduationYear: '',
    collegeEmail: '',
    idProof: null as string | null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start();
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const backAction = () => { router.back(); return true; };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }, [router])
  );

  const loadData = async () => {
    try {
      const saved = await AsyncStorage.getItem('@student_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setForm(prev => ({ 
            ...prev, 
            ...Object.fromEntries(Object.entries(parsed).filter(([_, v]) => v !== null)) 
          }));
        }
      }
    } catch (e) {
      console.error("Failed to load student data", e);
    }
  };

  const validation = useMemo(() => {
    const e: Record<string, string> = {};
    const curr = new Date().getFullYear();
    
    if (form.collegeName && (form.collegeName || '').length < 3) e.collegeName = "Too short";
    if (form.registerNumber && !/^[a-zA-Z0-9-]+$/.test(form.registerNumber)) e.registerNumber = "Alphanumeric only";
    
    if (form.graduationYear && (form.graduationYear || '').length === 4) {
      const yr = parseInt(form.graduationYear);
      if (yr < curr - 5 || yr > curr + 7) e.graduationYear = `Range: ${curr-5}-${curr+7}`;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (form.collegeEmail && !emailRegex.test(form.collegeEmail)) e.collegeEmail = "Invalid email";

    const missingSection = 
      !(form.collegeName || '').trim() ? "COLLEGE NAME" :
      !(form.department || '').trim() ? "DEPARTMENT" :
      (!(form.courseName || '').trim() || !(form.duration || '').trim()) ? "COURSE DETAILS" :
      !(form.registerNumber || '').trim() ? "REGISTER NUMBER" :
      ((form.graduationYear || '').length !== 4 || e.graduationYear) ? "GRADUATION YEAR" :
      (!form.collegeEmail || e.collegeEmail) ? "COLLEGE EMAIL" :
      !form.idProof ? "COLLEGE ID PROOF" : null;

    const isComplete = !missingSection;

    return { errors: e, isComplete, missingSection };
  }, [form]);

  const capturePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.6 });
    if (!result.canceled) {
      setForm(prev => ({ ...prev, idProof: result.assets[0].uri }));
    }
  };

  const handleSave = async () => {
    if (!validation.isComplete) return;
    setSaveState('loading');
    try {
      // 1. Local cache.
      await AsyncStorage.setItem('@student_data', JSON.stringify({ ...form, completed: true }));

      // 2. Upload college ID image, then POST /kyc/student.
      const { kycService, uploadKycDocument } = await import('@/services/api/features/kyc');
      const collegeIdImage =
        form.idProof && form.idProof.startsWith('file:')
          ? await uploadKycDocument('collegeIdImage', form.idProof)
          : form.idProof;

      await kycService.setStudent({
        collegeName: form.collegeName,
        enrollmentNumber: form.registerNumber,
        collegeIdImage,
      });

      setSaveState('success');
      setTimeout(() => router.replace('/kyc'), 800);
    } catch (e: unknown) {
      if (__DEV__) console.warn('Student save failed:', (e as Error).message);
      setSaveState('error');
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={styles.heroSection}>
            <LinearGradient colors={['#1800ad', '#2563EB']} style={StyleSheet.absoluteFillObject} />
            <SafeAreaView edges={['top']} style={styles.heroContent}>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.heroBody}>
                <View style={styles.heroIconBox}><Ionicons name="school" size={32} color="#FFF" /></View>
                <View style={styles.heroTextContent}>
                  <Text style={styles.heroTitle}>Student Protocol</Text>
                  <Text style={styles.heroSubtitle}>Academic background verification</Text>
                </View>
              </View>
            </SafeAreaView>
          </View>

          <View style={styles.contentWrapper}>
            <View style={styles.mattePanel}>
              <Input label="COLLEGE NAME" value={form.collegeName} onChangeText={v => updateField('collegeName', v)} error={validation.errors.collegeName} placeholder="Enter your college" success={(form.collegeName || '').length >= 3} />
              <Input label="DEPARTMENT" value={form.department} onChangeText={v => updateField('department', v)} placeholder="e.g. Computer Science" success={!!form.department} />
              <View style={styles.row}>
                <View style={{flex:1}}><Input label="COURSE" value={form.courseName} onChangeText={v => updateField('courseName', v)} placeholder="e.g. B.Tech" success={!!form.courseName} /></View>
                <View style={{width:12}} />
                <View style={{flex:0.8}}><Input label="DURATION" value={form.duration} onChangeText={v => updateField('duration', v)} placeholder="e.g. 4 Years" success={!!form.duration} /></View>
              </View>
              <Input label="REGISTER NUMBER" value={form.registerNumber} onChangeText={v => updateField('registerNumber', v.toUpperCase())} error={validation.errors.registerNumber} placeholder="College ID No." success={!!form.registerNumber && !validation.errors.registerNumber} />
              <Input label="GRADUATION YEAR" value={form.graduationYear} onChangeText={v => updateField('graduationYear', v.replace(/[^0-9]/g, ''))} error={validation.errors.graduationYear} placeholder="YYYY" keyboardType="numeric" maxLength={4} success={(form.graduationYear || '').length === 4 && !validation.errors.graduationYear} />
              <Input label="COLLEGE EMAIL ID" value={form.collegeEmail} onChangeText={v => updateField('collegeEmail', v.toLowerCase())} error={validation.errors.collegeEmail} placeholder="name@college.edu" keyboardType="email-address" success={!!form.collegeEmail && !validation.errors.collegeEmail} />
            </View>

            <View style={styles.mattePanel}>
              <Text style={styles.panelLabel}>COLLEGE ID PROOF</Text>
              <TouchableOpacity style={[styles.uploadBox, form.idProof && styles.uploadBoxActive]} onPress={capturePhoto}>
                {form.idProof ? (
                  <Image source={{ uri: form.idProof }} style={styles.previewImg} />
                ) : (
                  <View style={styles.uploadInner}>
                    <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
                    <Text style={styles.uploadText}>Capture ID Front</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.primaryCTA, !validation.isComplete && styles.primaryCTADisabled]} 
              onPress={handleSave} 
              disabled={!validation.isComplete || saveState === 'loading'}
            >
              <LinearGradient colors={['#1800ad', '#2563EB']} style={styles.ctaGradient}>
                {saveState === 'loading' ? <ActivityIndicator color="#FFF" /> : (
                  <><Text style={styles.ctaText}>SUBMIT ACADEMIC DATA</Text><Ionicons name="checkmark-done-circle" size={22} color="#FFF" /></>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingBottom: vs(100) },
  heroSection: { height: vs(240), borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl, overflow: 'hidden' },
  heroContent: { paddingHorizontal: SPACING.l },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginTop: SPACING.m },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: vs(30), paddingBottom: 20 },
  heroIconBox: { width: 64, height: 64, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  heroTextContent: { flex: 1 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 2 },
  contentWrapper: { paddingHorizontal: SPACING.l, marginTop: vs(20) },
  mattePanel: { backgroundColor: '#FFF', borderRadius: RADIUS.xl, padding: SPACING.l, marginBottom: SPACING.m, ...SHADOWS.soft, borderWidth: 1, borderColor: '#EDF2F7' },
  row: { flexDirection: 'row' },
  panelLabel: { fontSize: 10, fontWeight: '900', color: COLORS.slate[500], marginBottom: 15, letterSpacing: 1 },
  uploadBox: { height: 160, borderRadius: RADIUS.lg, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  uploadBoxActive: { borderStyle: 'solid', borderColor: COLORS.primary },
  uploadInner: { alignItems: 'center', gap: 8 },
  uploadText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  previewImg: { width: '100%', height: '100%' },
  primaryCTA: { height: 60, borderRadius: RADIUS.xl, overflow: 'hidden', marginTop: SPACING.m, ...SHADOWS.medium },
  primaryCTADisabled: { opacity: 0.6 },
  ctaGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  ctaText: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
});
