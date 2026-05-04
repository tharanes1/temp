import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { ms, vs } from '@/shared/utils/responsive';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';
const ALERT_RED = '#EF4444';

export default function WarningScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  // Theme support
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const { darkMode } = useSettings();
  const isDark = darkMode;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      
      {/* 🛡️ SLIM ALERT HEADER */}
      <View style={styles.headerHero}>
        <LinearGradient
          colors={[isDark ? '#450a0a' : '#FEE2E2', isDark ? '#1e1b4b' : bgColor]}
          style={StyleSheet.absoluteFillObject}
        />
        
        <SafeAreaView edges={['top']} style={styles.headerContent}>
          <View style={styles.navRow}>
            <View style={styles.statusPill}>
              <View style={styles.pulseDot} />
              <Text style={styles.statusText}>{t('warning.system_alert', 'SYSTEM ALERT')}</Text>
            </View>
          </View>

          <View style={styles.heroMain}>
             <View style={styles.iconContainer}>
               <Ionicons name="warning" size={40} color={ALERT_RED} />
             </View>
             <View style={styles.heroTextContent}>
               <Text style={[styles.heroTitle, { color: textColor }]}>{t('warning.hero_title')}</Text>
               <Text style={[styles.heroSub, { color: subtextColor }]}>{t('warning.hero_sub')}</Text>
             </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        <View style={styles.mainContent}>
          
          {/* SECTION 1: WHAT HAPPENED */}
          <View style={[styles.glassCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
             <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="information-outline" size={18} color={ALERT_RED} />
                <Text style={[styles.sectionLabel, { color: subtextColor }]}>{t('warning.question', 'INCIDENT DETAILS')}</Text>
             </View>
             <Text style={[styles.explanation, { color: textColor }]}>
                {t('warning.explanation')}
             </Text>
             <View style={[styles.alertBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2' }]}>
                <Ionicons name="shield-checkmark" size={16} color={ALERT_RED} />
                <Text style={[styles.alertBannerText, { color: ALERT_RED }]}>{t('warning.active_tip')}</Text>
             </View>
          </View>

          {/* SECTION 2: OPERATIONAL IMPACT */}
          <View style={styles.impactSection}>
            <Text style={[styles.groupTitle, { color: subtextColor }]}>{t('warning.performance_impact', 'OPERATIONAL IMPACT')}</Text>
            
            <View style={styles.statsRow}>
               <View style={[styles.statItem, { backgroundColor: cardColor, borderColor: borderColor }]}>
                  <View style={styles.statHeader}>
                    <Text style={[styles.statLabel, { color: subtextColor }]}>{t('warning.priority_score', 'PRIORITY')}</Text>
                    <Ionicons name="trending-down" size={14} color={ALERT_RED} />
                  </View>
                  <Text style={[styles.statValue, { color: ALERT_RED }]}>-5</Text>
                  <Text style={[styles.statSub, { color: subtextColor }]}>{t('warning.points', { count: 95 })}</Text>
               </View>

               <View style={[styles.statItem, { backgroundColor: cardColor, borderColor: borderColor }]}>
                  <View style={styles.statHeader}>
                    <Text style={[styles.statLabel, { color: subtextColor }]}>{t('warning.waiting_list', 'WAIT TIME')}</Text>
                    <Ionicons name="time-outline" size={14} color={textColor} />
                  </View>
                  <Text style={[styles.statValue, { color: textColor }]}>+5m</Text>
                  <Text style={[styles.statSub, { color: subtextColor }]}>{t('warning.next', 'NEXT SLOT')}</Text>
               </View>
            </View>
          </View>

          {/* SECTION 3: EXPERT ADVICE */}
          <View style={[styles.expertBox, { backgroundColor: isDark ? '#1e1b4b' : '#EEF2FF' }]}>
             <View style={styles.expertTop}>
                <MaterialCommunityIcons name="lightbulb-on" size={20} color={PRIMARY_BLUE} />
                <Text style={[styles.expertTitle, { color: PRIMARY_BLUE }]}>{t('warning.expert_tip_title', 'EXPERT ADVICE')}</Text>
             </View>
             <Text style={[styles.expertDesc, { color: PRIMARY_BLUE }]}>
                {t('warning.expert_tip_desc')}
             </Text>
          </View>

          {/* SECTION 4: RESOLUTION ACTIONS */}
          <View style={styles.actionArea}>
            <TouchableOpacity 
              style={styles.primaryBtn}
              onPress={() => router.replace('/(tabs)/home')}
              activeOpacity={0.8}
            >
               <LinearGradient colors={[ALERT_RED, '#B91C1C']} style={styles.btnGrad}>
                  <Text style={styles.primaryBtnText}>{t('warning.return_dashboard', 'RETURN TO DASHBOARD')}</Text>
                  <Ionicons name="home-outline" size={18} color="#FFF" />
               </LinearGradient>
            </TouchableOpacity>
          </View>

          <Text style={[styles.footerInfo, { color: subtextColor }]}>{t('warning.footer_note', { version: '2.4.1' })}</Text>
        </View>
      </ScrollView>

          </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerHero: {
    height: vs(200),
    paddingBottom: 20,
  },
  headerContent: { flex: 1, paddingHorizontal: 24 },
  navRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12 
  },
  statusPill: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)', 
    paddingHorizontal: 14, 
    paddingVertical: 6, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)'
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ALERT_RED,
    marginRight: 8,
  },
  statusText: { color: ALERT_RED, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  
  heroMain: { 
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 20
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  heroTextContent: { flex: 1 },
  heroTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  heroSub: { fontSize: 14, fontWeight: '500', marginTop: 4, opacity: 0.8 },
  
  scrollContent: { paddingBottom: 60 },
  mainContent: { paddingHorizontal: 24, marginTop: -20 },
  
  glassCard: { 
    borderRadius: 24, 
    padding: 24, 
    elevation: 8, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    marginBottom: 24, 
    borderWidth: 1,
    backgroundColor: '#FFF'
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  explanation: { fontSize: 15, lineHeight: 24, fontWeight: '600' },
  alertBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    marginTop: 20, 
    padding: 14, 
    borderRadius: 16 
  },
  alertBannerText: { fontSize: 12, fontWeight: '700', flex: 1 },
  
  impactSection: { marginBottom: 24 },
  groupTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 14, marginLeft: 4 },
  statsRow: { flexDirection: 'row', gap: 16 },
  statItem: { 
    flex: 1, 
    borderRadius: 20, 
    padding: 20, 
    borderWidth: 1, 
    alignItems: 'flex-start' 
  },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 8 },
  statLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statValue: { fontSize: 28, fontWeight: '900' },
  statSub: { fontSize: 10, fontWeight: '700', marginTop: 2, opacity: 0.6 },
  
  expertBox: { borderRadius: 24, padding: 24, marginBottom: 32 },
  expertTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  expertTitle: { fontSize: 16, fontWeight: '900' },
  expertDesc: { fontSize: 14, fontWeight: '600', lineHeight: 20, opacity: 0.9 },
  
  actionArea: { gap: 14, marginBottom: 30 },
  primaryBtn: { height: vs(65), borderRadius: 22, overflow: 'hidden', elevation: 6 },
  btnGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  
  secondaryBtn: { 
    height: vs(60), 
    borderRadius: 20, 
    borderWidth: 1.5, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  
  footerInfo: { textAlign: 'center', fontSize: 10, fontWeight: '800', opacity: 0.5 },
});
