import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

export default function TermsOfService() {
  const router = useRouter();
  const { t } = useTranslation();

  // Theme support
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const borderColor = useThemeColor({}, 'border');
  const cardColor = useThemeColor({}, 'card');
  const { darkMode } = useSettings();
  const isDark = darkMode;

  const sections = [
    { id: '1', title: t('terms.sections.s1_title'), desc: t('terms.sections.s1_desc'), icon: 'account-check-outline' },
    { id: '2', title: t('terms.sections.s2_title'), desc: t('terms.sections.s2_desc'), icon: 'shield-airplane-outline' },
    { id: '3', title: t('terms.sections.s3_title'), desc: t('terms.sections.s3_desc'), icon: 'wallet-outline' },
    { id: '4', title: t('terms.sections.s4_title'), desc: t('terms.sections.s4_desc'), icon: 'scale-balance' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      
      {/* 📜 ELITE HEADER */}
      <View style={styles.headerHero}>
        <LinearGradient
          colors={['#1800ad', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
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
            <View style={styles.headerTitleBox}>
               <Text style={styles.headerTag}>LEGAL FRAMEWORK</Text>
               <Text style={styles.headerTitle}>{t('terms.title')}</Text>
            </View>
            <TouchableOpacity style={styles.printBtn}>
               <Ionicons name="download-outline" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mainContent}>
          
          <Animated.View entering={FadeInDown.delay(200)} style={styles.heroSummary}>
             <BlurView intensity={20} style={styles.summaryBadge}>
                <MaterialCommunityIcons name="file-document-check-outline" size={20} color={PRIMARY_BLUE} />
                <Text style={[styles.summaryText, { color: textColor }]}>Last updated on April 27, 2026</Text>
             </BlurView>
             <Text style={[styles.heroIntro, { color: subtextColor }]}>
                Please review our terms of service to understand your rights and responsibilities as a Cravix operational partner.
             </Text>
          </Animated.View>

          {sections.map((sec, index) => (
            <Animated.View 
              key={sec.id} 
              entering={FadeInDown.delay(300 + index * 100)} 
              style={[styles.legalCard, { backgroundColor: cardColor, borderColor: borderColor }]}
            >
              <View style={styles.cardHeader}>
                 <View style={styles.iconBox}>
                    <MaterialCommunityIcons name={sec.icon as any} size={22} color={PRIMARY_BLUE} />
                 </View>
                 <Text style={[styles.cardTitle, { color: textColor }]}>{sec.title}</Text>
              </View>
              <Text style={[styles.cardDesc, { color: subtextColor }]}>{sec.desc}</Text>
            </Animated.View>
          ))}

          <View style={styles.footerSection}>
             <View style={[styles.divider, { backgroundColor: borderColor }]} />
             
             <Animated.View entering={FadeIn.delay(800)}>
                <TouchableOpacity activeOpacity={0.8} style={styles.acceptBtn} onPress={() => router.back()}>
                  <LinearGradient
                    colors={['#1800ad', '#4F46E5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.btnGradient}
                  />
                  <Text style={styles.acceptText}>{t('terms.accept')}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 10 }} />
                </TouchableOpacity>
             </Animated.View>
             
             <Text style={[styles.footerLegal, { color: subtextColor }]}>
                Cravix Logistics Operations • Version 2.4.1 (Enterprise)
             </Text>
          </View>
        </View>
      </ScrollView>
          </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerHero: { backgroundColor: PRIMARY_BLUE, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden', paddingBottom: 30 },
  headerGradient: { ...StyleSheet.absoluteFillObject },
  headerDecor: { ...StyleSheet.absoluteFillObject },
  decorCircle: { position: 'absolute', top: -50, right: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: '#FFF', opacity: 0.1 },
  decorGrid: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },
  headerContent: { paddingHorizontal: 25 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  headerTitleBox: { alignItems: 'center' },
  headerTag: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.6)', letterSpacing: 2 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  printBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 60 },
  mainContent: { paddingHorizontal: 25, marginTop: 30 },
  heroSummary: { marginBottom: 35 },
  summaryBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(24, 0, 173, 0.05)', borderWidth: 1, borderColor: 'rgba(24, 0, 173, 0.1)' },
  summaryText: { fontSize: 12, fontWeight: '800' },
  heroIntro: { fontSize: 15, fontWeight: '600', lineHeight: 22, marginTop: 15 },
  legalCard: { borderRadius: 24, padding: 24, marginBottom: 20, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 15 },
  iconBox: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(24, 0, 173, 0.06)', justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  cardDesc: { fontSize: 14, fontWeight: '600', lineHeight: 22, opacity: 0.9 },
  footerSection: { marginTop: 20 },
  divider: { height: 1, marginBottom: 30 },
  acceptBtn: { height: 60, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', elevation: 5, shadowColor: PRIMARY_BLUE, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 15 },
  btnGradient: { ...StyleSheet.absoluteFillObject },
  acceptText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  footerLegal: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 25, opacity: 0.5 },
});
