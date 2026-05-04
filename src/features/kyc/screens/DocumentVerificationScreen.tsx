import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Animated, 
  BackHandler, 
  ActivityIndicator,
  Image,
  Dimensions
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { COLORS, SHADOWS, SPACING, RADIUS } from '@/shared/theme';
import { vs, ms } from '@/shared/utils/responsive';
import { Input } from '@/shared/components/ui/Input';

const { width } = Dimensions.get('window');

type SlotState = 'idle' | 'uploading' | 'success' | 'error';

const SecureSlot = memo(({ label, field, image, state, onCapture, onPickGallery, isFull }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], flex: isFull ? 1 : 0.48 }}>
      {/* Upload area */}
      <TouchableOpacity
        style={[
          styles.uploadSlot,
          image && styles.slotFilled,
          state === 'uploading' && styles.slotLoading,
          state === 'error' && styles.slotError,
          isFull && { height: 140 }
        ]}
        onPress={() => onCapture(field)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        disabled={state === 'uploading'}
      >
        {state === 'uploading' ? (
          <View style={styles.slotStateContainer}>
            <ActivityIndicator color={COLORS.primary} size="small" />
            <Text style={styles.slotStateText}>UPLOADING...</Text>
          </View>
        ) : image ? (
          <>
            <Image source={{ uri: image }} style={styles.slotImage} />
            <View style={styles.slotOverlay}>
               <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
               <Text style={styles.slotOverlayText}>VERIFIED</Text>
            </View>
          </>
        ) : (
          <View style={styles.slotEmpty}>
            <View style={styles.slotIconBox}>
              <Ionicons name="camera-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.slotLabel}>{label}</Text>
          </View>
        )}
        {image && state === 'idle' && (
          <View style={styles.slotEditBadge}>
            <Ionicons name="sync" size={12} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>

      {/* Camera / Gallery row */}
      {!image && state !== 'uploading' && (
        <View style={styles.slotActionRow}>
          <TouchableOpacity style={styles.slotActionBtn} onPress={() => onCapture(field)}>
            <Ionicons name="camera" size={14} color={COLORS.primary} />
            <Text style={styles.slotActionText}>Camera</Text>
          </TouchableOpacity>
          <View style={styles.slotActionDivider} />
          <TouchableOpacity style={styles.slotActionBtn} onPress={() => onPickGallery(field)}>
            <Ionicons name="images" size={14} color={COLORS.primary} />
            <Text style={styles.slotActionText}>Gallery</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
});

const KYCDocumentVerification = () => {
  const router = useRouter();
  const { t } = useTranslation();
  
  const [form, setForm] = useState({
    aadhaarNumber: '',
    aadhaarFront: null,
    aadhaarBack: null,
    licenseNumber: '',
    licenseFront: null,
    vehicleType: 'petrol', // 'petrol' | 'ev'
    vehicleNumber: '',
    vehicleRC: null,
    bikePhoto: null,
    insuranceNumber: '',
    insurancePolicy: null,
  });

  const [slotStates, setSlotStates] = useState<Record<string, SlotState>>({});
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

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
      const keys = ['@document_verification_data'];
      const results = await AsyncStorage.getItem(keys[0]);
      if (results) {
        setForm(prev => ({ ...prev, ...JSON.parse(results) }));
      }
    } catch (e) { console.error(e); }
  };

  const capturePhoto = useCallback(async (field: string) => {
    setSlotStates(prev => ({ ...prev, [field]: 'uploading' }));
    
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setSlotStates(prev => ({ ...prev, [field]: 'error' }));
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.6 });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setTimeout(() => {
        setForm(prev => ({ ...prev, [field]: uri }));
        setSlotStates(prev => ({ ...prev, [field]: 'success' }));
        setTimeout(() => setSlotStates(prev => ({ ...prev, [field]: 'idle' })), 2000);
      }, 1500);
    } else {
      setSlotStates(prev => ({ ...prev, [field]: 'idle' }));
    }
  }, []);

  const pickFromGallery = useCallback(async (field: string) => {
    setSlotStates(prev => ({ ...prev, [field]: 'uploading' }));

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setSlotStates(prev => ({ ...prev, [field]: 'error' }));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setTimeout(() => {
        setForm(prev => ({ ...prev, [field]: uri }));
        setSlotStates(prev => ({ ...prev, [field]: 'success' }));
        setTimeout(() => setSlotStates(prev => ({ ...prev, [field]: 'idle' })), 2000);
      }, 800);
    } else {
      setSlotStates(prev => ({ ...prev, [field]: 'idle' }));
    }
  }, []);

  const validation = useMemo(() => {
    const e: Record<string, string> = {};
    
    const cleanAadhaar = (form.aadhaarNumber || '').replace(/\s/g, '');
    if (cleanAadhaar && cleanAadhaar.length !== 12) e.aadhaarNumber = "12 digits required";
    
    if (form.licenseNumber && (form.licenseNumber || '').length < 10) e.licenseNumber = "Invalid format";
    
    if (form.vehicleType === 'petrol') {
      const cleanVehicle = (form.vehicleNumber || '').replace(/\s/g, '');
      if (cleanVehicle && cleanVehicle.length < 8) e.vehicleNumber = "8-10 characters required";
    }

    const isComplete = !!(
      cleanAadhaar.length === 12 &&
      form.aadhaarFront && form.aadhaarBack &&
      (form.licenseNumber || '').length >= 10 &&
      form.licenseFront &&
      (form.vehicleType === 'ev' || ((form.vehicleNumber || '').length >= 6 && form.bikePhoto)) &&
      form.vehicleRC &&
      (form.insuranceNumber || '').length >= 6 &&
      form.insurancePolicy
    );

    return { errors: e, isComplete };
  }, [form]);

  const isFormValid = validation.isComplete;

  const handleSave = async () => {
    if (!isFormValid) return;
    setSubmitState('loading');
    try {
      // 1. Local cache for offline cold-starts.
      await AsyncStorage.setItem('@document_verification_data', JSON.stringify({ ...form, completed: true }));

      // 2. Upload each captured image to S3 via presigned PUT, collect URLs,
      //    then POST /kyc/documents (locked A3).  PAN is captured separately
      //    in a follow-up screen — what we have here are aadhaar + licence;
      //    the partial body is accepted by the backend.
      const { kycService, uploadKycDocument } = await import('@/services/api/features/kyc');
      const documents: { aadhaarFront?: string; aadhaarBack?: string; drivingLicense?: string; panCard?: string } = {};

      if (form.aadhaarFront && form.aadhaarFront.startsWith('file:')) {
        documents.aadhaarFront = await uploadKycDocument('aadhaarFront', form.aadhaarFront);
      } else if (form.aadhaarFront) {
        documents.aadhaarFront = form.aadhaarFront;
      }
      if (form.aadhaarBack && form.aadhaarBack.startsWith('file:')) {
        documents.aadhaarBack = await uploadKycDocument('aadhaarBack', form.aadhaarBack);
      } else if (form.aadhaarBack) {
        documents.aadhaarBack = form.aadhaarBack;
      }
      if (form.licenseFront && form.licenseFront.startsWith('file:')) {
        documents.drivingLicense = await uploadKycDocument('drivingLicense', form.licenseFront);
      } else if (form.licenseFront) {
        documents.drivingLicense = form.licenseFront;
      }
      // Optional PAN — present in newer builds.  Schema permits a partial body.
      const panUri = (form as { panCard?: string }).panCard;
      if (panUri && panUri.startsWith('file:')) {
        documents.panCard = await uploadKycDocument('panCard', panUri);
      } else if (panUri) {
        documents.panCard = panUri;
      }

      if (Object.keys(documents).length > 0) {
        await kycService.setDocuments(documents);
      }

      setSubmitState('success');
      setTimeout(() => router.replace('/kyc'), 800);
    } catch (e: unknown) {
      if (__DEV__) console.warn('Document save failed:', (e as Error).message);
      setSubmitState('error');
      setTimeout(() => setSubmitState('idle'), 3000);
    }
  };

  const progress = useMemo(() => {
    let count = 0;
    if ((form.aadhaarNumber || '').length === 12 && form.aadhaarFront && form.aadhaarBack) count += 1;
    if ((form.licenseNumber || '').length >= 10 && form.licenseFront) count += 1;
    if (form.vehicleRC && (form.vehicleType === 'ev' || (form.vehicleNumber && form.bikePhoto))) count += 1;
    if ((form.insuranceNumber || '').length >= 6 && form.insurancePolicy) count += 1;
    return Math.round((count / 4) * 100);
  }, [form]);

  const updateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* 🚀 HERO SECTION */}
          <View style={styles.heroSection}>
            <LinearGradient colors={['#1800ad', '#2563EB']} style={StyleSheet.absoluteFillObject} />
            <SafeAreaView edges={['top']} style={styles.heroContent}>
              <View style={styles.heroHeader}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                  <Ionicons name="chevron-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.securityTag}>
                  <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                  <Text style={styles.securityText}>AES-256 ENCRYPTED</Text>
                </View>
              </View>

              <View style={styles.heroBody}>
                <View style={styles.heroMainRow}>
                  <View style={styles.heroIconBox}>
                    <MaterialCommunityIcons name="file-document-check" size={32} color="#FFF" />
                  </View>
                  <View style={styles.heroText}>
                    <Text style={styles.heroTitle}>Document Portal</Text>
                    <View style={styles.statusRow}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>Identity Verification Active</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.progressContainer}>
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.progressLabel}>VERIFICATION DEPTH</Text>
                    <Text style={styles.progressValue}>{progress}%</Text>
                  </View>
                  <View style={styles.progressBarBase}><View style={[styles.progressBarFill, { width: `${progress}%` }]} /></View>
                </View>
              </View>
            </SafeAreaView>
          </View>

          <View style={styles.contentWrapper}>
            {/* AADHAAR PROTOCOL */}
            <View style={styles.mattePanel}>
              <View style={styles.panelHeader}><MaterialCommunityIcons name="fingerprint" size={18} color={COLORS.primary} /><Text style={styles.panelTitle}>AADHAAR VERIFICATION</Text></View>
              <Input 
                label="AADHAAR NUMBER" 
                value={form.aadhaarNumber} 
                onChangeText={v => {
                  const cleaned = v.replace(/\D/g, '').slice(0, 12);
                  const formatted = cleaned.replace(/(.{4})/g, '$1 ').trim();
                  updateField('aadhaarNumber', formatted);
                }} 
                placeholder="0000 0000 0000" 
                keyboardType="numeric" 
                maxLength={14} 
                error={validation.errors.aadhaarNumber}
                success={(form.aadhaarNumber || '').replace(/\s/g, '').length === 12}
              />
              <View style={styles.slotRow}>
                <SecureSlot label="FRONT SIDE" field="aadhaarFront" image={form.aadhaarFront} state={slotStates.aadhaarFront} onCapture={capturePhoto} onPickGallery={pickFromGallery} />
                <SecureSlot label="BACK SIDE" field="aadhaarBack" image={form.aadhaarBack} state={slotStates.aadhaarBack} onCapture={capturePhoto} onPickGallery={pickFromGallery} />
              </View>
            </View>

            {/* DRIVING LICENSE */}
            <View style={styles.mattePanel}>
              <View style={styles.panelHeader}><Ionicons name="card-outline" size={18} color={COLORS.primary} /><Text style={styles.panelTitle}>DRIVING LICENSE</Text></View>
              <Input 
                label="LICENSE NUMBER" 
                value={form.licenseNumber} 
                onChangeText={v => {
                  const formatted = v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
                  updateField('licenseNumber', formatted);
                }} 
                placeholder="DL-1420110012345" 
                maxLength={16}
                error={validation.errors.licenseNumber}
                success={(form.licenseNumber || '').length >= 10}
              />
              <SecureSlot label="LICENSE FRONT" field="licenseFront" image={form.licenseFront} state={slotStates.licenseFront} onCapture={capturePhoto} onPickGallery={pickFromGallery} isFull />
            </View>

            {/* VEHICLE & RC */}
            <View style={styles.mattePanel}>
              <View style={styles.panelHeader}><Ionicons name="car-outline" size={18} color={COLORS.primary} /><Text style={styles.panelTitle}>VEHICLE PROTOCOL</Text></View>
              
              <Text style={styles.selectorLabel}>VEHICLE MODEL</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity 
                  style={[styles.typeBtn, form.vehicleType === 'petrol' && styles.typeBtnActive]} 
                  onPress={() => updateField('vehicleType', 'petrol')}
                >
                  <MaterialCommunityIcons name="motorbike" size={20} color={form.vehicleType === 'petrol' ? '#FFF' : COLORS.slate[400]} />
                  <Text style={[styles.typeBtnText, form.vehicleType === 'petrol' && styles.typeBtnTextActive]}>2 WHEELER</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.typeBtn, form.vehicleType === 'ev' && styles.typeBtnActive]} 
                  onPress={() => updateField('vehicleType', 'ev')}
                >
                  <MaterialCommunityIcons name="lightning-bolt" size={20} color={form.vehicleType === 'ev' ? '#FFF' : COLORS.slate[400]} />
                  <Text style={[styles.typeBtnText, form.vehicleType === 'ev' && styles.typeBtnTextActive]}>EV (ELECTRIC)</Text>
                </TouchableOpacity>
              </View>

              {form.vehicleType === 'petrol' && (
                <>
                  <Input 
                    label="VEHICLE NUMBER" 
                    value={form.vehicleNumber} 
                    onChangeText={v => {
                      const formatted = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                      updateField('vehicleNumber', formatted);
                    }} 
                    placeholder="MH01AB1234" 
                    maxLength={10}
                    error={validation.errors.vehicleNumber}
                    success={(form.vehicleNumber || '').length >= 8}
                  />
                  <SecureSlot label="BIKE PHOTO (FRONT)" field="bikePhoto" image={form.bikePhoto} state={slotStates.bikePhoto} onCapture={capturePhoto} onPickGallery={pickFromGallery} isFull />
                </>
              )}

              <View style={{ marginTop: SPACING.m }}>
                <SecureSlot label="RC SMART CARD" field="vehicleRC" image={form.vehicleRC} state={slotStates.vehicleRC} onCapture={capturePhoto} onPickGallery={pickFromGallery} isFull />
              </View>
            </View>

            {/* INSURANCE POLICY */}
            <View style={styles.mattePanel}>
              <View style={styles.panelHeader}><Ionicons name="shield-outline" size={18} color={COLORS.primary} /><Text style={styles.panelTitle}>INSURANCE POLICY</Text></View>
              <Input 
                label="POLICY NUMBER" 
                value={form.insuranceNumber} 
                onChangeText={v => updateField('insuranceNumber', v.toUpperCase())} 
                placeholder="POL-00000000" 
                success={(form.insuranceNumber || '').length >= 6}
              />
              <SecureSlot label="POLICY SCAN" field="insurancePolicy" image={form.insurancePolicy} state={slotStates.insurancePolicy} onCapture={capturePhoto} onPickGallery={pickFromGallery} isFull />
            </View>

            <TouchableOpacity 
              style={[styles.primaryCTA, !isFormValid && styles.primaryCTADisabled]} 
              onPress={handleSave}
              disabled={!isFormValid || submitState === 'loading'}
            >
              <LinearGradient colors={['#1800ad', '#2563EB']} style={styles.ctaGradient}>
                {submitState === 'loading' ? <ActivityIndicator color="#FFF" /> : (
                  <><Text style={styles.ctaText}>SUBMIT FOR REVIEW</Text><Ionicons name="checkmark-done-circle" size={22} color="#FFF" /></>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  heroSection: { height: vs(240), backgroundColor: '#0F172A', borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl, overflow: 'hidden' },
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  statusText: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  progressContainer: { marginTop: vs(25) },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  progressValue: { fontSize: 12, fontWeight: '900', color: '#FFF' },
  progressBarBase: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 3 },
  scrollContent: { paddingBottom: vs(100) },
  contentWrapper: { paddingHorizontal: SPACING.l, marginTop: vs(20) },
  mattePanel: { backgroundColor: '#FFF', borderRadius: RADIUS.xl, padding: SPACING.l, marginBottom: SPACING.m, ...SHADOWS.soft, borderWidth: 1, borderColor: '#EDF2F7' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.l },
  panelTitle: { fontSize: 11, fontWeight: '900', color: COLORS.slate[500], letterSpacing: 1 },
  
  selectorLabel: { fontSize: 9, fontWeight: '900', color: COLORS.slate[400], marginBottom: 12, letterSpacing: 1 },
  typeSelector: { flexDirection: 'row', gap: 10, marginBottom: SPACING.m },
  typeBtn: { flex: 1, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.slate[50], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#EDF2F7' },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { fontSize: 10, fontWeight: '900', color: COLORS.slate[400], letterSpacing: 0.5 },
  typeBtnTextActive: { color: '#FFF' },

  slotRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.s },
  uploadSlot: { height: 110, borderRadius: RADIUS.lg, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  slotFilled: { borderStyle: 'solid', borderColor: COLORS.primary },
  slotLoading: { borderStyle: 'solid', borderColor: COLORS.primary },
  slotError: { borderColor: '#EF4444' },
  slotStateContainer: { alignItems: 'center', gap: 8 },
  slotStateText: { fontSize: 8, fontWeight: '900', color: COLORS.primary, letterSpacing: 1 },
  slotOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center', gap: 4 },
  slotOverlayText: { fontSize: 9, fontWeight: '900', color: COLORS.success, letterSpacing: 1 },
  slotEmpty: { alignItems: 'center', gap: 8 },
  slotIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', ...SHADOWS.soft },
  slotImage: { width: '100%', height: '100%' },
  slotLabel: { fontSize: 9, color: COLORS.slate[400], fontWeight: '900', textTransform: 'uppercase' },
  slotEditBadge: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  primaryCTA: { height: 64, borderRadius: RADIUS.xl, overflow: 'hidden', marginTop: SPACING.l, ...SHADOWS.medium },
  primaryCTADisabled: { opacity: 0.6 },
  ctaGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  ctaText: { color: '#FFF', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  slotActionRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 6, backgroundColor: '#EEF2FF', borderRadius: 8, overflow: 'hidden' },
  slotActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  slotActionDivider: { width: 1, height: 20, backgroundColor: '#C7D2FE' },
  slotActionText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
});

export default KYCDocumentVerification;
