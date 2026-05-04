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

export default function DisabilityDetailsScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    details: '',
    certificateNumber: '',
    proofImage: null as string | null,
  });

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
      const saved = await AsyncStorage.getItem('@disabled_data');
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
      console.error("Failed to load disabled data", e);
    }
  };

  const validation = useMemo(() => {
    const e: Record<string, string> = {};
    
    if (form.certificateNumber && (form.certificateNumber || '').length < 5) e.certificateNumber = "Too short";
    if (form.certificateNumber && !/^[a-zA-Z0-9/-]+$/.test(form.certificateNumber)) e.certificateNumber = "Alphanumeric only";
    
    if (form.details && (form.details || '').length < 20) e.details = "Description too brief (min 20)";
    if (form.details && (form.details || '').length > 300) e.details = "Max 300 characters";

    const missingSection = 
      !(form.certificateNumber || '').trim() ? "CERTIFICATE NUMBER" :
      ((form.certificateNumber || '').length < 5 || e.certificateNumber) ? "VALID CERTIFICATE NO." :
      !(form.details || '').trim() ? "DISABILITY DETAILS" :
      ((form.details || '').length < 20 || e.details) ? "DETAILED DESCRIPTION" :
      !form.proofImage ? "CERTIFICATE PHOTO" : null;

    const isComplete = !missingSection;

    return { errors: e, isComplete, missingSection };
  }, [form]);

  const capturePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.6 });
    if (!result.canceled) {
      setForm(prev => ({ ...prev, proofImage: result.assets[0].uri }));
    }
  };

  const handleSave = async () => {
    if (!validation.isComplete) return;
    setSaveState('loading');
    try {
      // 1. Local cache.
      await AsyncStorage.setItem('@disabled_data', JSON.stringify({ ...form, completed: true }));

      // 2. Upload disability proof, then POST /kyc/disabled (locked spec gap).
      const { kycService, uploadKycDocument } = await import('@/services/api/features/kyc');
      const disabilityProof =
        form.proofImage && form.proofImage.startsWith('file:')
          ? await uploadKycDocument('disabilityProof', form.proofImage)
          : form.proofImage;

      await kycService.setDisabled({
        disabilityCertNumber: form.certificateNumber,
        disabilityDetails: form.details,
        disabilityProof,
      });

      setSaveState('success');
      setTimeout(() => router.replace('/kyc'), 800);
    } catch (e: unknown) {
      if (__DEV__) console.warn('Disabled save failed:', (e as Error).message);
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
                <View style={styles.heroIconBox}><MaterialCommunityIcons name="wheelchair-accessibility" size={32} color="#FFF" /></View>
                <View style={styles.heroTextContent}>
                  <Text style={styles.heroTitle}>Inclusive Support</Text>
                  <Text style={styles.heroSubtitle}>Disability certificate verification</Text>
                </View>
              </View>
            </SafeAreaView>
          </View>

          <View style={styles.contentWrapper}>
            <View style={styles.mattePanel}>
              <Input 
                label="CERTIFICATE NUMBER" 
                value={form.certificateNumber} 
                onChangeText={v => updateField('certificateNumber', v.toUpperCase())} 
                error={validation.errors.certificateNumber} 
                placeholder="UDID or Certificate No." 
                success={(form.certificateNumber || '').length >= 5 && !validation.errors.certificateNumber}
              />
              <Input 
                label="DISABILITY DETAILS" 
                value={form.details} 
                onChangeText={v => updateField('details', v)} 
                error={validation.errors.details} 
                placeholder="Describe briefly for better assistance" 
                multiline
                numberOfLines={3}
                success={(form.details || '').trim().length >= 20}
              />
            </View>

            <View style={styles.mattePanel}>
              <Text style={styles.panelLabel}>CERTIFICATE PHOTO</Text>
              <TouchableOpacity style={[styles.uploadBox, form.proofImage && styles.uploadBoxActive]} onPress={capturePhoto}>
                {form.proofImage ? (
                  <Image source={{ uri: form.proofImage }} style={styles.previewImg} />
                ) : (
                  <View style={styles.uploadInner}>
                    <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
                    <Text style={styles.uploadText}>Capture Certificate</Text>
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
                  <><Text style={styles.ctaText}>SUBMIT MEDICAL DATA</Text><Ionicons name="checkmark-done-circle" size={22} color="#FFF" /></>
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
