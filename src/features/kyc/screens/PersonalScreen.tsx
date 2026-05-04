import React, { useEffect, useRef, memo, useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Animated, BackHandler, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COLORS, TYPOGRAPHY, SHADOWS, SPACING, RADIUS } from '@/shared/theme';
import { vs, ms, s } from '@/shared/utils/responsive';
import { Input } from '@/shared/components/ui/Input';

// Custom Components & Hooks
import LocationPicker from '@/features/kyc/components/LocationPicker';
import { useTranslation } from 'react-i18next';
import { usePersonalForm } from '@/features/kyc/components/usePersonalForm';

const { width } = Dimensions.get('window');

type ComponentState = 'idle' | 'loading' | 'success' | 'error';

const KYCPersonalScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { form, errors, updateForm, loadData, saveData } = usePersonalForm();
  
  // States
  const [saveState, setSaveState] = useState<ComponentState>('idle');
  const [photoState, setPhotoState] = useState<ComponentState>('idle');
  const [lastSync, setLastSync] = useState(0);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start();

    loadData();
    const timer = setInterval(() => setLastSync(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const backAction = () => { router.back(); return true; };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }, [router])
  );

  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  const captureImage = async () => {
    setPhotoState('loading');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setPhotoState('error');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7, aspect: [1, 1] });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      updateForm({ profilePhoto: uri });
      await AsyncStorage.setItem('@kyc_profile_photo', uri);
      setPhotoState('success');
      setTimeout(() => setPhotoState('idle'), 2000);
    } else {
      setPhotoState('idle');
    }
  };

  const handleSave = async () => {
    setSaveState('loading');
    const success = await saveData();
    if (success) {
      setSaveState('success');
      setTimeout(() => router.back(), 800);
    } else {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  const progress = useMemo(() => {
    let count = 0;
    if (form.profilePhoto) count += 1;
    if (form.fullName && form.email && form.age) count += 1;
    if (form.address) count += 1;
    return Math.round((count / 3) * 100);
  }, [form]);

  const missingInfo = useMemo(() => {
    if (!form.profilePhoto) return "PROFILE PHOTO";
    if (!form.fullName || !form.email || !form.age || !form.gender || !form.dob) return "BASIC DETAILS";
    if (!form.address || !form.pincode) return "ADDRESS DETAILS";
    return null;
  }, [form]);

  const isFormValid = useMemo(() => {
    return !!(
      form.profilePhoto && form.fullName && form.email && form.age && form.gender && 
      form.dob && form.otpVerified && form.address && form.state && form.city && form.pincode &&
      Object.keys(errors).length === 0
    );
  }, [form, errors]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* 🚀 COMMAND CENTER HERO */}
          <View style={styles.heroSection}>
            <LinearGradient colors={['#1800ad', '#2563EB']} style={StyleSheet.absoluteFillObject} />
            <SafeAreaView edges={['top']} style={styles.heroContent}>
              <View style={styles.heroHeader}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                  <Ionicons name="chevron-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.securityTag}>
                  <Ionicons name="lock-closed" size={10} color="#10B981" />
                  <Text style={styles.securityText}>SSL 256-BIT</Text>
                </View>
              </View>

              <View style={styles.heroBody}>
                <View style={styles.avatarStack}>
                  <TouchableOpacity style={styles.mainAvatar} onPress={captureImage} activeOpacity={0.9}>
                    {form.profilePhoto ? (
                      <Image source={{ uri: form.profilePhoto }} style={styles.avatarImg} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={32} color="rgba(255,255,255,0.4)" />
                      </View>
                    )}
                    <View style={[styles.avatarStatus, { backgroundColor: photoState === 'loading' ? COLORS.primary : photoState === 'success' ? COLORS.success : COLORS.primary }]}>
                      {photoState === 'loading' ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name={form.profilePhoto ? "checkmark" : "camera"} size={14} color="#FFF" />}
                    </View>
                  </TouchableOpacity>
                  <View style={styles.heroInfo}>
                    <Text style={styles.heroTitle}>Personal Protocol</Text>
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>STATUS:</Text>
                      <Text style={[styles.statusValue, { color: progress === 100 ? '#4ADE80' : '#FBBF24' }]}>
                        {progress === 100 ? 'VALIDATED' : 'ACTION REQUIRED'}
                      </Text>
                      <Text style={styles.syncText}>• Sync {lastSync}s ago</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.progressLabel}>VERIFICATION PROGRESS</Text>
                    <Text style={styles.progressValue}>{progress}%</Text>
                  </View>
                  <View style={styles.progressBarBase}>
                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                  </View>
                </View>
              </View>
            </SafeAreaView>
          </View>

          <View style={styles.contentWrapper}>
            {/* CORE DATA */}
            <View style={styles.mattePanel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>CORE IDENTITY</Text>
                <Ionicons name="finger-print" size={16} color={COLORS.slate[300]} />
              </View>

              <Input 
                label="LEGAL FULL NAME" 
                value={form.fullName} 
                onChangeText={(v) => updateForm({ fullName: v })} 
                placeholder="As per Identity Card" 
                error={errors.fullName} 
              />
              <Input 
                label="EMAIL ADDRESS" 
                value={form.email} 
                onChangeText={(v) => updateForm({ email: v })} 
                placeholder="name@company.com" 
                keyboardType="email-address" 
                error={errors.email} 
              />
              
              <View style={styles.gridRow}>
                <View style={{ flex: 1 }}>
                  <Input 
                    label="AGE" 
                    value={form.age} 
                    onChangeText={(v) => updateForm({ age: v })} 
                    placeholder="18+" 
                    keyboardType="numeric" 
                    maxLength={2} 
                    error={errors.age} 
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1.5 }}>
                   <Text style={styles.inputMicroLabel}>GENDER</Text>
                   <View style={styles.genderGrid}>
                      {['male', 'female', 'other'].map((g) => (
                        <TouchableOpacity 
                          key={g} 
                          style={[styles.genderBox, form.gender === g && styles.genderBoxActive]} 
                          onPress={() => updateForm({ gender: g as any })}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.genderBoxText, form.gender === g && styles.genderBoxTextActive]}>{g.toUpperCase()}</Text>
                        </TouchableOpacity>
                      ))}
                   </View>
                </View>
              </View>
              <Input label="DATE OF BIRTH" value={form.dob} onChangeText={(v) => updateForm({ dob: v })} placeholder="DD / MM / YYYY" />
            </View>



            {/* GEOLOCATION PROTOCOL */}
            <LocationPicker 
              initialAddress={{
                address: form.address,
                city: form.city,
                district: form.district,
                state: form.state,
                pincode: form.pincode
              }}
              onAddressChange={(data) => updateForm(data)}
              errorPincode={errors.pincode}
            />

            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity 
                style={[styles.primaryCTA, !isFormValid && styles.primaryCTADisabled]} 
                onPress={handleSave}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                disabled={!isFormValid || saveState === 'loading'}
                activeOpacity={1}
              >
                <LinearGradient
                  colors={!isFormValid ? ['#E2E8F0', '#CBD5E1'] : saveState === 'error' ? ['#EF4444', '#B91C1C'] : ['#1800ad', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGradient}
                >
                  {saveState === 'loading' ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Text style={styles.ctaText}>SAVE & CONTINUE</Text>
                      <Ionicons name="arrow-forward-circle" size={22} color="#FFF" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.footerInfo}>
               <Ionicons name="shield-checkmark" size={12} color={COLORS.slate[300]} />
               <Text style={styles.footerText}>ENCRYPTED END-TO-END CONNECTION</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  heroSection: { height: vs(260), backgroundColor: '#1800ad', borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl, overflow: 'hidden' },
  heroContent: { flex: 1, paddingHorizontal: SPACING.l },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.m },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  securityTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  securityText: { fontSize: 9, fontWeight: '900', color: '#10B981', letterSpacing: 1 },
  
  heroBody: { marginTop: vs(25) },
  avatarStack: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  mainAvatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', padding: 2 },
  avatarImg: { flex: 1, borderRadius: 35 },
  avatarPlaceholder: { flex: 1, borderRadius: 35, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  avatarStatus: { position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0F172A' },
  
  heroInfo: { flex: 1 },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusLabel: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.5)' },
  statusValue: { fontSize: 10, fontWeight: '900', color: '#4ADE80' },
  syncText: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },

  progressContainer: { marginTop: vs(20) },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.8)', letterSpacing: 1 },
  progressValue: { fontSize: 11, fontWeight: '900', color: '#FFF' },
  progressBarBase: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 3 },

  scrollContent: { paddingBottom: vs(100) },
  contentWrapper: { paddingHorizontal: SPACING.l, marginTop: vs(20) },

  mattePanel: { backgroundColor: '#FFF', borderRadius: RADIUS.xl, padding: SPACING.l, marginBottom: SPACING.m, ...SHADOWS.soft, borderWidth: 1, borderColor: '#EDF2F7' },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.l },
  panelTitle: { fontSize: 11, fontWeight: '900', color: COLORS.slate[500], letterSpacing: 1.5 },

  gridRow: { flexDirection: 'row' },
  inputMicroLabel: { fontSize: 9, fontWeight: '900', color: COLORS.slate[400], marginBottom: 8, letterSpacing: 1 },
  genderGrid: { flexDirection: 'row', gap: 8 },
  genderBox: { flex: 1, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.slate[50], justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EDF2F7' },
  genderBoxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  genderBoxText: { fontWeight: '900', color: COLORS.slate[400], fontSize: 12 },
  genderBoxTextActive: { color: '#FFF' },

  primaryCTA: { height: 64, borderRadius: RADIUS.xl, overflow: 'hidden', marginTop: SPACING.l, ...SHADOWS.medium },
  primaryCTADisabled: { opacity: 0.6 },
  ctaGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  ctaText: { color: '#FFF', fontWeight: '900', fontSize: 15, letterSpacing: 1 },

  footerInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: SPACING.xl },
  footerText: { fontSize: 9, color: COLORS.slate[400], fontWeight: '800', letterSpacing: 1 },
});

export default memo(KYCPersonalScreen);
