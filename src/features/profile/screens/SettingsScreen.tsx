import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Switch,
  Platform,
  Dimensions,
  Alert,
  Image
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '@/core/providers/SettingsContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/core/providers/LanguageContext';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useAuthStore } from '@/features/auth/state/authStore';
import { authService } from '@/services/api/features/auth';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

export default function Settings() {
  const router = useRouter();
  const { t } = useTranslation();
  const { language, changeLanguage } = useLanguage();

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
  const { 
    darkMode, setDarkMode, 
    notifications, setNotifications, 
    locationSharing, setLocationSharing 
  } = useSettings();

  // Theme support
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const cardAltColor = useThemeColor({}, 'cardSecondary');

  const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'ta', label: 'தமிழ்' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'kn', label: 'ಕನ್ನಡ' },
    { code: 'ml', label: 'മലയാളം' },
    { code: 'te', label: 'తెలుగు' }
  ];

  const handleLogout = async () => {
    Alert.alert(
      t('settings.logout'),
      t('settings.logout_alert'),
      [
        { text: t('common.cancel'), style: "cancel" },
        { 
          text: t('settings.logout'), 
          style: "destructive", 
          onPress: async () => {
            try {
              await authService.logout();
            } catch {
              // best-effort
            }
            await useAuthStore.getState().logout();
            router.replace('/login');
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      
      {/* 🔴 PREMIUM HEADER */}
      <View style={styles.header}>
        <LinearGradient
          colors={['#1800ad', '#2563EB']}
          style={styles.headerGradient}
        />
        <SafeAreaView edges={['top']} style={styles.headerContent}>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('settings.title')}</Text>
            <View style={styles.placeholder} />
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mainContent}>
          
          {/* SECTION: FINANCIALS */}
          <Text style={[styles.sectionLabel, { color: subtextColor }]}>{t('settings.financials').toUpperCase()}</Text>
          <View style={[styles.optionsCard, { backgroundColor: cardColor, borderColor: borderColor, borderWidth: 1 }]}>
            <SettingItem 
              icon="wallet-outline" 
              label={t('settings.payment_history')} 
              textColor={textColor}
              borderColor={borderColor}
              onPress={() => router.push('/payment-history')} 
            />
            <SettingItem 
              icon="card-outline" 
              label={t('settings.bank_accounts')} 
              textColor={textColor}
              borderColor={borderColor}
              onPress={() => router.push('/bank-accounts')} 
            />
            <SettingItem 
              icon="receipt-outline" 
              label={t('settings.tax_invoices')} 
              textColor={textColor}
              borderColor={borderColor}
              isLast 
              onPress={() => Alert.alert(t('settings.tax_invoices'), "Invoice generation for this month will be available on the 1st.")}
            />
          </View>

          {/* SECTION: LANGUAGE SELECTION */}
          <Text style={[styles.sectionLabel, { color: subtextColor }]}>{t('settings.language').toUpperCase()}</Text>
          <View style={[styles.optionsCard, { backgroundColor: cardColor, borderColor: borderColor, borderWidth: 1 }]}>
            {LANGUAGES.map((item, index) => (
              <TouchableOpacity 
                key={item.code} 
                style={[styles.settingRow, index === LANGUAGES.length - 1 && { borderBottomWidth: 0 }, { borderBottomColor: borderColor }]}
                onPress={() => changeLanguage(item.code as any)}
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.rowLabel, { color: textColor }, language === item.code && { color: PRIMARY_BLUE, fontWeight: '900' }]}>{item.label}</Text>
                </View>
                {language === item.code && <Ionicons name="checkmark-circle" size={22} color={PRIMARY_BLUE} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* SECTION: PREFERENCES */}
          <Text style={[styles.sectionLabel, { color: subtextColor }]}>{t('settings.preferences').toUpperCase()}</Text>
          <View style={[styles.optionsCard, { backgroundColor: cardColor, borderColor: borderColor, borderWidth: 1 }]}>
            <View style={[styles.settingRow, { borderBottomColor: borderColor }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="notifications-outline" size={22} color={PRIMARY_BLUE} />
                <Text style={[styles.rowLabel, { color: textColor }]}>{t('settings.notifications')}</Text>
              </View>
              <Switch 
                value={notifications} 
                onValueChange={setNotifications}
                trackColor={{ false: '#E2E8F0', true: PRIMARY_BLUE }}
                thumbColor={Platform.OS === 'ios' ? '#FFF' : notifications ? '#FFF' : '#F1F5F9'}
              />
            </View>
            <View style={[styles.settingRow, { borderBottomColor: borderColor }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="moon-outline" size={22} color={PRIMARY_BLUE} />
                <Text style={[styles.rowLabel, { color: textColor }]}>{t('settings.dark_mode')}</Text>
              </View>
              <Switch 
                value={darkMode} 
                onValueChange={setDarkMode}
                trackColor={{ false: '#E2E8F0', true: PRIMARY_BLUE }}
              />
            </View>
            <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="location-outline" size={22} color={PRIMARY_BLUE} />
                <Text style={[styles.rowLabel, { color: textColor }]}>{t('settings.location')}</Text>
              </View>
              <Switch 
                value={locationSharing} 
                onValueChange={setLocationSharing}
                trackColor={{ false: '#E2E8F0', true: PRIMARY_BLUE }}
              />
            </View>
          </View>

          {/* SECTION: SUPPORT */}
          <Text style={[styles.sectionLabel, { color: subtextColor }]}>{t('settings.support_legal').toUpperCase()}</Text>
          <View style={[styles.optionsCard, { backgroundColor: cardColor, borderColor: borderColor, borderWidth: 1 }]}>
            <SettingItem 
              icon="help-circle-outline" 
              label={t('settings.help_center')} 
              textColor={textColor}
              borderColor={borderColor}
              onPress={() => router.push('/help-center')} 
            />
            <SettingItem 
              icon="shield-checkmark-outline" 
              label={t('settings.privacy_policy')} 
              textColor={textColor}
              borderColor={borderColor}
              onPress={() => router.push('/privacy-policy')}
            />
            <SettingItem 
              icon="document-text-outline" 
              label={t('settings.terms_service')} 
              textColor={textColor}
              borderColor={borderColor}
              isLast 
              onPress={() => router.push('/terms-of-service')}
            />
          </View>

          {/* DANGER ZONE */}
          <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: darkMode ? '#450a0a' : '#FFF1F2', borderColor: darkMode ? '#991b1b' : '#FECACA' }]} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>{t('settings.logout')}</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[styles.versionTag, { color: subtextColor }]}>Cravix Rider v4.2.0 (Build 882)</Text>
            <Text style={[styles.copyTag, { color: borderColor }]}>© 2026 Cravix Technologies Private Limited</Text>
          </View>
        </View>
      </ScrollView>

          </View>
  );
}

function SettingItem({ icon, label, onPress, isLast, textColor, borderColor }: any) {
  return (
    <TouchableOpacity 
      style={[styles.settingRow, isLast && { borderBottomWidth: 0 }, { borderBottomColor: borderColor }]} 
      onPress={onPress}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={22} color={PRIMARY_BLUE} />
        <Text style={[styles.rowLabel, { color: textColor }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 140,
    backgroundColor: PRIMARY_BLUE,
    zIndex: 100,
    elevation: 5,
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
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
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
  },
  placeholder: {
    width: 44,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  mainContent: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginLeft: 5,
  },
  optionsCard: {
    borderRadius: 25,
    marginBottom: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#EF4444',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
    gap: 5,
  },
  versionTag: {
    fontSize: 12,
    fontWeight: '800',
  },
  copyTag: {
    fontSize: 10,
    fontWeight: '600',
  },
  decorImg: {
    width: '100%',
    height: '100%',
  },
});
