import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions 
} from 'react-native';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/core/providers/UserContext';
import { COLORS } from '@/shared/theme';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

export default function AppGuide() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setTourStep } = useUser();

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.back();
        return true;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );

      return () => subscription.remove();
    }, [router])
  );

  // Theme support
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const cardAltColor = useThemeColor({}, 'cardSecondary');
  const { darkMode } = useSettings();
  const isDark = darkMode;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* 🔴 HERO HEADER */}
      <View style={styles.headerHero}>
        <LinearGradient
          colors={['#1800ad', '#2563EB']}
          style={styles.headerGradient}
        />
        <View style={styles.blob1} />
        <View style={styles.blob2} />

        <SafeAreaView edges={['top']} style={styles.headerContent}>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitleText}>{t('guide.title')}</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.heroMain}>
            <Text style={styles.heroTag}>{t('guide.hero_tag')}</Text>
            <Text style={styles.heroTitle}>{t('guide.hero_title')}</Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          
          <GuideCard 
            icon={<Ionicons name="home" size={28} color={PRIMARY_BLUE} />}
            title={t('guide.home_title')}
            desc={t('guide.home_desc')}
            cardColor={cardColor}
            borderColor={borderColor}
            textColor={textColor}
            subtextColor={subtextColor}
            iconBg={cardAltColor}
            onPress={() => router.push('/(tabs)/home?showTour=true')}
          />

          <GuideCard 
            icon={<Ionicons name="calendar-outline" size={28} color={PRIMARY_BLUE} />}
            title={t('guide.shifts_title')}
            desc={t('guide.shifts_desc')}
            cardColor={cardColor}
            borderColor={borderColor}
            textColor={textColor}
            subtextColor={subtextColor}
            iconBg={cardAltColor}
            onPress={() => router.push('/(tabs)/shifts?showTour=true')}
          />

          <GuideCard 
            icon={<Ionicons name="cube-outline" size={28} color={PRIMARY_BLUE} />}
            title={t('guide.orders_title')}
            desc={t('guide.orders_desc')}
            cardColor={cardColor}
            borderColor={borderColor}
            textColor={textColor}
            subtextColor={subtextColor}
            iconBg={cardAltColor}
            onPress={() => router.push('/(tabs)/orders?showTour=true')}
          />

          <GuideCard 
            icon={<Ionicons name="card-outline" size={28} color={PRIMARY_BLUE} />}
            title={t('guide.earnings_title')}
            desc={t('guide.earnings_desc')}
            cardColor={cardColor}
            borderColor={borderColor}
            textColor={textColor}
            subtextColor={subtextColor}
            iconBg={cardAltColor}
            onPress={() => router.push('/(tabs)/earnings?showTour=true')}
          />

          <GuideCard 
            icon={<Ionicons name="person" size={28} color={PRIMARY_BLUE} />}
            title={t('guide.profile_title')}
            desc={t('guide.profile_desc')}
            cardColor={cardColor}
            borderColor={borderColor}
            textColor={textColor}
            subtextColor={subtextColor}
            iconBg={cardAltColor}
            onPress={() => router.push('/(tabs)/profile?showTour=true')}
          />
          
          <GuideCard 
            icon={<MaterialCommunityIcons name="wallet-outline" size={28} color={PRIMARY_BLUE} />}
            title={t('guide.wallet_title')}
            desc={t('guide.wallet_desc')}
            cardColor={cardColor}
            borderColor={borderColor}
            textColor={textColor}
            subtextColor={subtextColor}
            iconBg={cardAltColor}
            onPress={() => router.push('/cashinhand?showTour=true')}
          />

          <View style={styles.footerNote}>
            <Text style={[styles.footerText, { color: subtextColor }]}>
              {t('guide.footer_note')}
            </Text>
            <Text style={[styles.adminNote, { color: COLORS.primary }]}>
              * Instructions and manuals can be edited and added by the admin from the admin panel.
            </Text>
          </View>
        </View>
      </ScrollView>
          </View>
  );
}

function GuideCard({ icon, title, desc, cardColor, borderColor, textColor, subtextColor, iconBg, onPress }: any) {
  return (
    <TouchableOpacity 
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.card, { backgroundColor: cardColor, borderColor: borderColor }]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconHole, { backgroundColor: iconBg }]}>
          {icon}
        </View>
        <Text style={[styles.cardTitle, { color: textColor }]}>{title}</Text>
      </View>
      <Text style={[styles.cardDesc, { color: subtextColor }]}>{desc}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerHero: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 340, 
    backgroundColor: PRIMARY_BLUE, 
    borderBottomLeftRadius: 50, 
    borderBottomRightRadius: 50, 
    overflow: 'hidden',
    zIndex: 0
  },
  headerGradient: { ...StyleSheet.absoluteFillObject },
  blob1: { position: 'absolute', top: -50, right: -50, width: 250, height: 250, borderRadius: 125, backgroundColor: '#1E293B', opacity: 0.2 },
  blob2: { position: 'absolute', bottom: -40, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: '#1655D9', opacity: 0.15 },
  headerContent: { paddingHorizontal: 25 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitleText: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  heroMain: { marginTop: 35, gap: 8 },
  heroTag: { fontSize: 11, fontWeight: '900', color: 'rgba(255,255,255,0.6)', letterSpacing: 2 },
  heroTitle: { fontSize: 32, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  scrollContent: {
    paddingBottom: 60,
  },
  mainContent: {
    paddingHorizontal: 25,
    marginTop: 220, // Proper overlap for the cards
    zIndex: 10,
  },
  card: {
    borderRadius: 25,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 15,
  },
  iconHole: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
    flex: 1,
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  footerNote: {
    padding: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 18,
  },
  adminNote: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '800',
    marginTop: 15,
    fontStyle: 'italic',
    paddingHorizontal: 20,
  }
});
