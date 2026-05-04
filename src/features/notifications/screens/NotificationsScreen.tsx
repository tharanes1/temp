import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Platform, 
  Dimensions 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useTranslation } from 'react-i18next';
import { ms, s, vs, SCREEN_WIDTH } from '@/shared/utils/responsive';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

// NOTIFICATIONS_DATA mock removed — feed comes from /api/v1/notifications via
// `useNotifications`.

/** Type → presentational icon + tint mapping (server stays type-agnostic). */
const TYPE_STYLE: Record<string, { icon: string; color: string }> = {
  order_assigned: { icon: 'package-variant-closed', color: '#3B82F6' },
  order_accepted: { icon: 'check-decagram', color: '#6366F1' },
  order_cancelled: { icon: 'timer-off-outline', color: '#EF4444' },
  order_delivered: { icon: 'cash-multiple', color: '#10B981' },
  withdrawal: { icon: 'bank-transfer-out', color: '#10B981' },
  money_earned: { icon: 'wallet-plus-outline', color: '#F59E0B' },
  duty_status: { icon: 'power', color: '#3B82F6' },
  system: { icon: 'shield-check-outline', color: '#8B5CF6' },
};

const formatRelative = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'Just now';
  if (ms < 60 * 60_000) return `${Math.floor(ms / 60_000)} mins ago`;
  if (ms < 24 * 60 * 60_000) return `${Math.floor(ms / (60 * 60_000))} hours ago`;
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function Notifications() {
  const router = useRouter();
  const { t } = useTranslation();
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');

  const { items, loading, markRead, markAllRead } = useNotifications();

  const getIcon = (type: string, color: string) => {
    const style = TYPE_STYLE[type];
    if (!style) return <Ionicons name="notifications" size={24} color={color} />;
    return <MaterialCommunityIcons name={style.icon as never} size={24} color={color} />;
  };

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
            <Text style={styles.headerTitleText}>Updates</Text>
            <TouchableOpacity style={styles.clearBtn} onPress={() => void markAllRead()}>
              <Text style={styles.clearBtnText}>MARK READ</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroMain}>
            <Text style={styles.heroTag}>RIDER ACTIVITY</Text>
            <Text style={styles.heroTitle}>Notifications</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.listContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: subtextColor }]}>RECENT ACTIVITY</Text>
        </View>

        {items.length === 0 && !loading ? (
          <View style={[styles.notifCard, { backgroundColor: cardColor, borderColor }]}>
            <View style={styles.contentBox}>
              <Text style={[styles.notifTitle, { color: textColor }]}>You're all caught up</Text>
              <Text style={[styles.messageText, { color: subtextColor }]}>
                New mission updates and earnings alerts will appear here.
              </Text>
            </View>
          </View>
        ) : null}

        {items.map((item) => {
          const style = TYPE_STYLE[item.type] ?? TYPE_STYLE.system!;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.notifCard,
                {
                  backgroundColor: cardColor,
                  borderColor,
                  opacity: item.isRead ? 0.6 : 1,
                },
              ]}
              onPress={() => !item.isRead && void markRead(item.id)}
            >
              <View style={[styles.iconBox, { backgroundColor: style.color + '15' }]}>
                {getIcon(item.type, style.color)}
              </View>

              <View style={styles.contentBox}>
                <View style={styles.topRow}>
                  <Text style={[styles.notifTitle, { color: textColor }]}>{item.title}</Text>
                  <Text style={[styles.timeText, { color: subtextColor }]}>
                    {formatRelative(item.createdAt)}
                  </Text>
                </View>
                <Text style={[styles.messageText, { color: subtextColor }]} numberOfLines={2}>
                  {item.body}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
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
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.7)',
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
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  sectionHeader: {
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  notifCard: {
    flexDirection: 'row',
    padding: 18,
    borderRadius: 24,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    alignItems: 'center',
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentBox: {
    flex: 1,
    marginLeft: 15,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 10,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  }
});
