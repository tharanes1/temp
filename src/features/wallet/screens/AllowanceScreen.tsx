import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { useTranslation } from 'react-i18next';
import { ms, vs } from '@/shared/utils/responsive';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';
const FUEL_GREEN = '#10B981';

export default function AllowanceScreen() {
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
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={[styles.safeHeader, { backgroundColor: cardColor }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]}>{t('profile.fuel_allowance', 'Fuel Allowance')}</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ⛽ ALLOWANCE BALANCE CARD */}
        <View style={styles.balanceCard}>
           <LinearGradient colors={['#064e3b', '#065f46']} style={styles.balanceGradient}>
              <View style={styles.balanceHeader}>
                 <MaterialCommunityIcons name="gas-station" size={24} color="#A7F3D0" />
                 <Text style={styles.balanceTag}>{t('allowance.available_balance', 'AVAILABLE CREDIT')}</Text>
              </View>
              <Text style={styles.balanceAmount}>₹850.00</Text>
              <View style={styles.balanceFooter}>
                 <View style={styles.syncRow}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.syncText}>{t('allowance.admin_controlled', 'Controlled by Admin Panel')}</Text>
                 </View>
              </View>
           </LinearGradient>
           <View style={styles.cardPattern}>
              <MaterialCommunityIcons name="fuel" size={120} color="rgba(255,255,255,0.05)" />
           </View>
        </View>

        <View style={[styles.infoBanner, { backgroundColor: isDark ? '#1e1b4b' : '#EEF2FF' }]}>
           <Ionicons name="information-circle" size={20} color={PRIMARY_BLUE} />
           <Text style={[styles.infoText, { color: PRIMARY_BLUE }]}>
              {t('allowance.info_msg', 'Your petrol allowance is automatically calculated based on your distance and approved by the admin team.')}
           </Text>
        </View>

        <View style={styles.sectionHeader}>
           <Text style={[styles.sectionTitle, { color: textColor }]}>{t('allowance.history_title', 'Allowance History')}</Text>
        </View>

        {/* MOCK HISTORY ITEMS */}
        {[
          { id: 1, date: '28 Apr, 2026', amount: 250, type: 'CREDIT', status: 'Approved', hub: 'Cravix Hub A' },
          { id: 2, date: '25 Apr, 2026', amount: 300, type: 'CREDIT', status: 'Approved', hub: 'Cravix Hub B' },
          { id: 3, date: '22 Apr, 2026', amount: 300, type: 'CREDIT', status: 'Approved', hub: 'Cravix Hub A' },
        ].map((item) => (
          <View key={item.id} style={[styles.historyCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
             <View style={styles.historyIconBox}>
                <MaterialCommunityIcons name="gas-station-outline" size={22} color={FUEL_GREEN} />
             </View>
             <View style={styles.historyBody}>
                <Text style={[styles.historyHub, { color: textColor }]}>{item.hub}</Text>
                <Text style={[styles.historyDate, { color: subtextColor }]}>{item.date}</Text>
             </View>
             <View style={styles.historyRight}>
                <Text style={styles.historyAmount}>+₹{item.amount}</Text>
                <View style={styles.statusBadge}>
                   <Text style={styles.statusText}>{item.status}</Text>
                </View>
             </View>
          </View>
        ))}

        <View style={[styles.footerNote, { backgroundColor: cardColor, borderColor: borderColor }]}>
           <Text style={[styles.noteTitle, { color: textColor }]}>{t('allowance.note_title', 'How it works?')}</Text>
           <Text style={[styles.noteBody, { color: subtextColor }]}>
              {t('allowance.note_body', '1. Complete your daily shifts.\n2. Admin calculates your eligible distance.\n3. Allowance is credited directly to this wallet.')}
           </Text>
        </View>

      </ScrollView>

          </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeHeader: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 15,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  balanceCard: {
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#064e3b',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    marginBottom: 25,
  },
  balanceGradient: {
    padding: 25,
    minHeight: 160,
    justifyContent: 'space-between',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  balanceTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#A7F3D0',
    letterSpacing: 1.5,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFF',
    marginVertical: 10,
  },
  balanceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  syncText: {
    fontSize: 11,
    color: '#A7F3D0',
    fontWeight: '600',
  },
  cardPattern: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    opacity: 0.5,
  },
  infoBanner: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 20,
    gap: 12,
    marginBottom: 25,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  sectionHeader: {
    marginBottom: 15,
    paddingLeft: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  historyCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 22,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  historyIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyBody: {
    flex: 1,
    marginLeft: 15,
  },
  historyHub: {
    fontSize: 15,
    fontWeight: '700',
  },
  historyDate: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: FUEL_GREEN,
  },
  statusBadge: {
    marginTop: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    color: FUEL_GREEN,
    textTransform: 'uppercase',
  },
  footerNote: {
    marginTop: 20,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  noteBody: {
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '500',
  },
  decorImg: {
    width: '100%',
    height: '100%',
  },
});
