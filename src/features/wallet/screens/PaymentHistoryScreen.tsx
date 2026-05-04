import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions,
  BackHandler
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { useWalletHistory, useWalletBalance } from '@/features/wallet/hooks/useWallet';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

export default function PaymentHistory() {
  const router = useRouter();
  const { t } = useTranslation();

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
  const { darkMode } = useSettings();
  const isDark = darkMode;

  // Server-driven transactions + summary.  Replaces the previously-hardcoded
  // 6-row mock and the literal ₹12,450 / ₹8,500 summary header.
  const { items: rawTxns } = useWalletHistory();
  const { balance } = useWalletBalance();

  const transactions = rawTxns.map((t) => {
    const ts = new Date(t.timestamp);
    const date = ts.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    return {
      id: t.id,
      type: t.type,
      missionId: t.referenceId ?? '',
      amount: t.amount,
      date,
      status: t.status,
    };
  });
  const summaryEarnings = balance?.totalBalance ?? 0;
  // "Withdrawn" = sum of negative wallet transactions in the listed page (cheap proxy).
  const summaryWithdrawn = Math.abs(
    rawTxns.filter((t) => t.amount < 0).reduce((acc, t) => acc + t.amount, 0),
  );

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      
      {/* 🔴 PREMIUM HISTORY HEADER */}
      <View style={styles.header}>
        <LinearGradient
          colors={[PRIMARY_BLUE, '#2563EB']}
          style={styles.headerGradient}
        />
        <SafeAreaView edges={['top']} style={styles.headerContent}>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('payment.title')}</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('payment.summary_earnings')}</Text>
              <Text style={styles.summaryValue}>₹{summaryEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('payment.summary_withdrawn')}</Text>
              <Text style={styles.summaryValue}>₹{summaryWithdrawn.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mainContent}>
          
          {transactions.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={[styles.transactionCard, { backgroundColor: cardColor, borderColor: borderColor, borderWidth: isDark ? 1 : 0 }]}
            >
              <View style={[styles.typeIcon, { backgroundColor: item.amount > 0 ? (isDark ? '#064e3b' : '#ECFDF4') : (isDark ? '#450a0a' : '#FEF2F2') }]}>
                 <MaterialCommunityIcons 
                   name={item.type === 'earning' ? 'package-variant-closed' : item.type === 'withdrawal' ? 'bank-transfer-out' : 'star-outline'} 
                   size={24} 
                   color={item.amount > 0 ? '#10B981' : '#EF4444'} 
                 />
              </View>

              <View style={styles.details}>
                <Text style={[styles.transTitle, { color: textColor }]}>
                   {item.type === 'earning' ? t('payment.types.earning', { id: item.missionId }) : t(`payment.types.${item.type}`)}
                </Text>
                <Text style={[styles.transDate, { color: subtextColor }]}>{item.date}</Text>
              </View>

              <View style={styles.amountArea}>
                <Text style={[styles.amountText, { color: item.amount > 0 ? '#10B981' : textColor }]}>
                   {item.amount > 0 ? '+' : ''}₹{Math.abs(item.amount).toFixed(2)}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: isDark ? '#1e1b4b' : '#F1F5F9' }]}>
                   <Text style={[styles.statusText, { color: subtextColor }]}>{t(`payment.status.${item.status}`)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.loadMoreBtn}>
             <Text style={styles.loadMoreText}>{t('payment.load_earlier')}</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
          </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 220, backgroundColor: PRIMARY_BLUE },
  headerGradient: { ...StyleSheet.absoluteFillObject },
  headerContent: { flex: 1, paddingHorizontal: 20 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  summaryRow: { flexDirection: 'row', marginTop: 30, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingVertical: 20, paddingHorizontal: 10 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  summaryValue: { fontSize: 24, fontWeight: '900', color: '#FFF', marginTop: 4 },
  separator: { width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.2)' },
  scrollContent: { paddingBottom: 40 },
  mainContent: { paddingHorizontal: 20, marginTop: 20 },
  transactionCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, marginBottom: 12 },
  typeIcon: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  details: { flex: 1, marginLeft: 15 },
  transTitle: { fontSize: 14, fontWeight: '800' },
  transDate: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  amountArea: { alignItems: 'flex-end' },
  amountText: { fontSize: 15, fontWeight: '900' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
  statusText: { fontSize: 9, fontWeight: '900' },
  loadMoreBtn: { marginTop: 10, paddingVertical: 15, alignItems: 'center' },
  loadMoreText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: '#94A3B8' }
});
