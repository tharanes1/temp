import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Platform 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

// Theme & Utils
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useTranslation } from 'react-i18next';
import { ms } from '@/shared/utils/responsive';

// Components
import { LeaderboardPodium } from '../components/LeaderboardPodium';
import { LeaderboardRow } from '../components/LeaderboardRow';
import { useLeaderboard } from '@/features/earnings/hooks/useLeaderboard';

const PRIMARY_BLUE = '#1800ad';

// LEADERBOARD_DATA mock removed — privacy rule (first-name + last-initial)
// is enforced server-side; the FE renders `displayName` directly.

export default function LeaderboardScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');

  const { data } = useLeaderboard({ period: 'today' });
  // Adapt server DTO → existing presentational shape (LeaderboardPodium / Row
  // expect `{ id, name, deliveries, image, rank }`).  We map `displayName` → name
  // and `orders` → deliveries.
  const adapted = (data?.topRiders ?? []).map((r) => ({
    id: String(r.rank),
    name: r.displayName,
    deliveries: r.orders,
    image: r.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(r.displayName)}`,
    rank: r.rank,
  }));
  const topThree = adapted.slice(0, 3);
  const others = adapted.slice(3, 10);

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar style="light" />

      {/* 🔴 PREMIUM HERO HEADER */}
      <View style={[styles.headerHero, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
        <LinearGradient
          colors={['#1800ad', '#2563EB']}
          style={styles.headerGradient}
        />
        <View style={styles.blob1} />
        <View style={styles.blob2} />

        <View style={styles.headerContent}>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitleText}>{t('leaderboard.hub_title')}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('leaderboard.season', { count: 1 })}</Text>
            </View>
          </View>

          <View style={styles.heroMain}>
            <Text style={styles.heroTag}>{t('leaderboard.top_tag')}</Text>
            <Text style={styles.heroTitle}>{t('leaderboard.title')}</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.listContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LeaderboardPodium topThree={topThree} textColor={textColor} />

        {others.map((item) => (
          <LeaderboardRow 
            key={item.id}
            item={item}
            textColor={textColor}
            subtextColor={subtextColor}
            cardColor={cardColor}
            borderColor={borderColor}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerHero: { 
    backgroundColor: PRIMARY_BLUE, 
    borderBottomLeftRadius: 50, 
    borderBottomRightRadius: 50, 
    overflow: 'hidden',
    paddingBottom: 40,
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  blob1: {
    position: 'absolute',
    top: -ms(40),
    right: -ms(30),
    width: ms(160),
    height: ms(160),
    borderRadius: ms(80),
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  blob2: {
    position: 'absolute',
    bottom: -ms(20),
    left: -ms(40),
    width: ms(120),
    height: ms(120),
    borderRadius: ms(60),
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerContent: {
    paddingHorizontal: 25,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
  heroMain: {
    marginTop: 25,
    gap: 8,
  },
  heroTag: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  listContainer: {
    flex: 1,
    marginTop: -25,
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 50,
  }
});
