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
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

export default function PrivacyPolicy() {
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
    { title: t('privacy.section1_title'), content: t('privacy.section1_content'), icon: 'database-search-outline' },
    { title: t('privacy.section2_title'), content: t('privacy.section2_content'), icon: 'shield-lock-outline' },
    { title: t('privacy.section3_title'), content: t('privacy.section3_content'), icon: 'share-variant-outline' },
    { title: t('privacy.section4_title'), content: t('privacy.section4_content'), icon: 'account-cog-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      
      {/* 🔒 ELITE HEADER */}
      <View style={styles.headerHero}>
        <LinearGradient
          colors={['#1800ad', '#2563EB']}
          style={styles.headerGradient}
        />
        <View style={styles.headerDecor}>
           <View style={styles.decorBlob} />
        </View>

        <SafeAreaView edges={['top']} style={styles.headerContent}>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerTitleBox}>
               <Text style={styles.headerTag}>DATA PROTECTION</Text>
               <Text style={styles.headerTitle}>{t('privacy.title')}</Text>
            </View>
            <TouchableOpacity style={styles.lockBtn}>
               <Ionicons name="shield-checkmark-outline" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mainContent}>
          
          <Animated.View entering={FadeInDown.delay(200)} style={styles.policySummary}>
             <BlurView intensity={20} style={styles.updateBadge}>
                <View style={styles.statusDot} />
                <Text style={[styles.updateText, { color: textColor }]}>{t('privacy.last_updated')}</Text>
             </BlurView>
             <Text style={[styles.summaryText, { color: subtextColor }]}>
                Your privacy is paramount. This policy outlines how we handle, protect, and utilize your operational data on the Cravix network.
             </Text>
          </Animated.View>

          {sections.map((sec, index) => (
            <Animated.View 
              key={index} 
              entering={FadeInDown.delay(300 + index * 100)} 
              style={[styles.policySection, { backgroundColor: cardColor, borderColor: borderColor }]}
            >
              <View style={styles.sectionHeader}>
                 <View style={styles.iconHole}>
                    <MaterialCommunityIcons name={sec.icon as any} size={22} color={PRIMARY_BLUE} />
                 </View>
                 <Text style={[styles.sectionTitle, { color: textColor }]}>{sec.title}</Text>
              </View>
              <Text style={[styles.sectionBody, { color: subtextColor }]}>{sec.content}</Text>
            </Animated.View>
          ))}

          <View style={styles.complianceBox}>
             <MaterialCommunityIcons name="check-decagram" size={20} color="#10B981" />
             <Text style={[styles.complianceText, { color: subtextColor }]}>GDPR & ISO 27001 COMPLIANT</Text>
          </View>
          
          <Text style={[styles.footerLegal, { color: subtextColor }]}>
            {t('privacy.footer')}
          </Text>
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
  decorBlob: { position: 'absolute', bottom: -40, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.08)' },
  headerContent: { paddingHorizontal: 25 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  headerTitleBox: { alignItems: 'center' },
  headerTag: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.6)', letterSpacing: 2 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  lockBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 60 },
  mainContent: { paddingHorizontal: 25, marginTop: 30 },
  policySummary: { marginBottom: 35 },
  updateBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(24, 0, 173, 0.05)', borderWidth: 1, borderColor: 'rgba(24, 0, 173, 0.1)' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  updateText: { fontSize: 11, fontWeight: '800' },
  summaryText: { fontSize: 15, fontWeight: '600', lineHeight: 22, marginTop: 15 },
  policySection: { borderRadius: 28, padding: 24, marginBottom: 20, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 15 },
  iconHole: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(24, 0, 173, 0.06)', justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  sectionBody: { fontSize: 14, fontWeight: '600', lineHeight: 22, opacity: 0.9 },
  complianceBox: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 10, opacity: 0.6 },
  complianceText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  footerLegal: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 25, opacity: 0.4, lineHeight: 18 },
});
