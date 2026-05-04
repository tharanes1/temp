import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { useAlerts } from '@/features/notifications/hooks/useAlerts';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

interface AppNotification {
  id: string;
  type: 'mission' | 'earnings' | 'system' | 'safety';
  title: string;
  message: string;
  time: string;
  isNew: boolean;
}

// INITIAL_NOTIFICATIONS removed — feed comes from /api/v1/notifications/alerts
// (system-level broadcasts) via `useAlerts`.

const SEVERITY_TYPE: Record<'info' | 'warning' | 'critical', AppNotification['type']> = {
  info: 'system',
  warning: 'safety',
  critical: 'safety',
};

const formatTime = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'Just Now';
  if (ms < 60 * 60_000) return `${Math.floor(ms / 60_000)} mins ago`;
  if (ms < 24 * 60 * 60_000) return `${Math.floor(ms / (60 * 60_000))} hours ago`;
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short' });
};

export default function AlertsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { alerts } = useAlerts();
  // Server alerts → existing presentational `AppNotification` shape so the JSX
  // below stays untouched.
  const notifications: AppNotification[] = alerts.map((a) => ({
    id: a.id,
    type: SEVERITY_TYPE[a.severity],
    title: a.title,
    message: a.body,
    time: formatTime(a.expiresAt),
    isNew: new Date(a.expiresAt).getTime() - Date.now() > 60 * 60_000,
  }));
  const [_unused, setNotifications] = useState<AppNotification[]>([]);

  // Theme support
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const cardAltColor = useThemeColor({}, 'cardSecondary');
  const { darkMode } = useSettings();

  const clearAll = () => {
    setNotifications([]);
  };

  const getIcon = (type: AppNotification['type'], title?: string) => {
    const isDark = darkMode;

    if (title === 'Mission Received') {
      return { name: 'radar', color: '#10B981', bg: isDark ? '#064e3b' : '#ECFDF5', isMCN: true };
    }
    if (title === 'Mission Missed') {
      return { name: 'close-circle-outline', color: '#EF4444', bg: isDark ? '#450a0a' : '#FEF2F2', isMCN: true };
    }

    switch (type) {
      case 'mission':
        return { name: 'sparkles', color: PRIMARY_BLUE, bg: isDark ? '#1e1b4b' : '#EEF2FF', isMCN: false, label: t('alerts.types.mission') };
      case 'earnings':
        return { name: 'flash', color: '#F59E0B', bg: isDark ? '#451a03' : '#FFFBEB', isMCN: false, label: t('alerts.types.earnings') };
      case 'system':
        return { name: 'settings', color: '#3B82F6', bg: isDark ? '#172554' : '#EFF6FF', isMCN: false, label: t('alerts.types.system') };
      case 'safety':
        return { name: 'shield-checkmark', color: '#10B981', bg: isDark ? '#064e3b' : '#ECFDF5', isMCN: false, label: t('alerts.types.safety') };
      default:
        return { name: 'notifications', color: '#64748B', bg: isDark ? '#1e293b' : '#F1F5F9', isMCN: false, label: 'ALERT' };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      
      {/* PREMIUM HEADER */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#1800ad', '#2563EB']}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView edges={['top']} style={styles.headerContent}>
          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('alerts.title')}</Text>
            <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>{t('alerts.clear_all')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconCircle, { backgroundColor: cardAltColor }]}>
               <Ionicons name="notifications-off-outline" size={60} color={borderColor} />
            </View>
            <Text style={[styles.emptyTitle, { color: textColor }]}>{t('alerts.empty_title')}</Text>
            <Text style={[styles.emptySub, { color: subtextColor }]}>{t('alerts.empty_sub')}</Text>
            <TouchableOpacity style={styles.backToHomeBtn} onPress={() => router.replace('/(tabs)')}>
               <Text style={styles.backToHomeText}>{t('alerts.back_to_dashboard')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.notifList}>
            <Text style={[styles.sectionLabel, { color: subtextColor }]}>{t('alerts.recent_updates')}</Text>
            {notifications.map((notif) => {
              const iconData = getIcon(notif.type, notif.title);
              return (
                <TouchableOpacity key={notif.id} style={[styles.notifCard, { backgroundColor: cardColor, borderColor: borderColor }]} activeOpacity={0.7}>
                  <View style={[styles.iconBox, { backgroundColor: iconData.bg }]}>
                    {iconData.isMCN ? (
                      <MaterialCommunityIcons name={iconData.name as any} size={28} color={iconData.color} />
                    ) : (
                      <Ionicons name={iconData.name as any} size={24} color={iconData.color} />
                    )}
                  </View>
                  <View style={styles.notifInfo}>
                    <View style={styles.notifHeader}>
                      <Text style={[styles.notifTypeLabel, { color: iconData.color }]}>{(iconData as any).label || notif.type.toUpperCase()}</Text>
                      {notif.isNew && <View style={styles.newBadge} />}
                    </View>
                    <Text style={[styles.notifTitle, { color: textColor }]}>{t(`alerts.mock.m${notif.id}_title`)}</Text>
                    <Text style={[styles.notifMessage, { color: subtextColor }]} numberOfLines={2}>
                      {t(`alerts.mock.m${notif.id}_msg`)}
                    </Text>
                    <View style={styles.footerRow}>
                      <Text style={[styles.notifTime, { color: subtextColor }]}>{notif.time}</Text>
                      <Ionicons name="chevron-forward" size={14} color={borderColor} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

          </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    height: 130,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#1800ad',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: 25,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  notifList: {
    paddingHorizontal: 20,
    paddingTop: 25,
    gap: 15,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 5,
    marginLeft: 5,
  },
  notifCard: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 3,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifInfo: {
    flex: 1,
    marginLeft: 15,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifTypeLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  newBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginLeft: 10,
  },
  notifMessage: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  notifTime: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 10,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  backToHomeBtn: {
    marginTop: 30,
    backgroundColor: PRIMARY_BLUE,
    paddingHorizontal: 25,
    paddingVertical: 14,
    borderRadius: 15,
    shadowColor: PRIMARY_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  backToHomeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  decorImage: {
    width: '100%',
    height: '100%',
  },
});
