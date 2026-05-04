import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useRef, useEffect } from 'react';
import { Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { ms, vs } from '@/shared/utils/responsive';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

export default function InstructionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const bgColor = useThemeColor({}, 'background');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const steps = [
    { id: '1', title: t('instructions.steps.s1_title'), desc: t('instructions.steps.s1_desc'), icon: 'power' },
    { id: '2', title: t('instructions.steps.s2_title'), desc: t('instructions.steps.s2_desc'), icon: 'gesture-tap' },
    { id: '3', title: t('instructions.steps.s3_title'), desc: t('instructions.steps.s3_desc'), icon: 'map-marker-distance' },
    { id: '4', title: t('instructions.steps.s4_title'), desc: t('instructions.steps.s4_desc'), icon: 'finance' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      
      {/* 🔴 INSTRUCTIONAL HEADER */}
      <View style={styles.headerHero}>
        <LinearGradient
          colors={[PRIMARY_BLUE, '#2563EB']}
          style={styles.headerGradient}
        />
        <View style={styles.blob1} />
        <View style={styles.blob2} />

        <SafeAreaView edges={['top']} style={styles.headerContent}>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitleText}>{t('instructions.title')}</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.heroMain}>
            <Text style={styles.heroTag}>{t('instructions.hero_tag')}</Text>
            <Text style={styles.heroTitle}>{t('instructions.hero_title')}</Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View 
          style={[
            styles.mainContent, 
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          {steps.map((step, index) => (
            <View key={step.id} style={styles.stepRow}>
               <View style={styles.timelineArea}>
                  <View style={[styles.stepCircle, { backgroundColor: PRIMARY_BLUE }]}>
                     <Text style={styles.stepCircleText}>{step.id}</Text>
                  </View>
                  {index !== steps.length - 1 && <View style={[styles.timelineLine, { backgroundColor: 'rgba(24,0,173,0.1)' }]} />}
               </View>

               <View style={styles.stepCard}>
                  <View style={styles.stepHeader}>
                     <MaterialCommunityIcons name={step.icon as any} size={22} color={PRIMARY_BLUE} />
                     <Text style={styles.stepLabel}>{t('instructions.step_prefix')} {step.id}</Text>
                  </View>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
               </View>
            </View>
          ))}

          <TouchableOpacity style={styles.confirmBtn} onPress={() => router.back()}>
             <LinearGradient colors={[PRIMARY_BLUE, '#2563EB']} style={styles.btnGrad}>
                <Text style={styles.btnText}>{t('instructions.got_it')}</Text>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
             </LinearGradient>
          </TouchableOpacity>

          <View style={styles.helpFooter}>
             <Ionicons name="help-circle-outline" size={20} color={PRIMARY_BLUE + '60'} />
             <View>
                <Text style={styles.helpText}>{t('instructions.help_note')}</Text>
                <Text style={[styles.helpText, { color: PRIMARY_BLUE, marginTop: 5, fontSize: 10, fontStyle: 'italic' }]}>
                  * Instructions and manuals can be edited and added by the admin from the admin panel.
                </Text>
             </View>
          </View>
        </Animated.View>
      </ScrollView>
          </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerHero: {
    height: 240,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  headerGradient: { ...StyleSheet.absoluteFillObject },
  blob1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  blob2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerContent: { paddingHorizontal: 25 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitleText: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  heroMain: { marginTop: 30, gap: 8 },
  heroTag: { fontSize: 12, fontWeight: '900', color: 'rgba(255,255,255,0.6)', letterSpacing: 2 },
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#FFF', lineHeight: 36 },
  scrollContent: { paddingBottom: 60 },
  mainContent: { flex: 1, marginTop: 20, paddingHorizontal: 20, paddingBottom: 40 },
  stepRow: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  timelineArea: { alignItems: 'center', width: 40 },
  stepCircle: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  stepCircleText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  timelineLine: { width: 2, flex: 1, marginTop: 5 },
  stepCard: { 
    flex: 1, 
    backgroundColor: 'rgba(255,255,255,0.9)', 
    borderRadius: 20, 
    padding: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  stepLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#94A3B8' },
  stepTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  stepDesc: { fontSize: 13, fontWeight: '600', marginTop: 6, lineHeight: 20, color: '#64748B' },
  confirmBtn: { height: 65, borderRadius: 22, overflow: 'hidden', marginTop: 10 },
  btnGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  helpFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 30 },
  helpText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
});
