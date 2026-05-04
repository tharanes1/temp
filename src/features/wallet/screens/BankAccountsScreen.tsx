import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { useBankAccounts } from '@/features/wallet/hooks/useWallet';
import { COLORS, SHADOWS, RADIUS, SPACING } from '@/shared/theme';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

export default function BankAccounts() {
  const router = useRouter();
  const { accounts } = useBankAccounts();
  // Adapt the first/primary server account to the legacy `bankData` shape so
  // the existing `paymentCard` renderer below stays untouched.
  const primary = accounts.find((a) => a.isPrimary) ?? accounts[0] ?? null;
  const bankData = primary
    ? {
        bankName: primary.bankName,
        accountHolder: primary.accountHolderName,
        accountNumber: primary.accountNumberMasked,
        ifsc: primary.ifscCode,
        status: primary.status,
      }
    : null;

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
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <LinearGradient colors={['#1800ad', '#2563EB']} style={styles.headerGradient} />
        <SafeAreaView edges={['top']} style={styles.headerContent}>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Payout Channels</Text>
            <TouchableOpacity style={styles.viewBtn} onPress={() => router.push('/add-bank')}>
                <Ionicons name="add-circle-outline" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mainContent}>
          
          {bankData ? (
            paymentCard(bankData)
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
                <Ionicons name="card-outline" size={60} color={subtextColor} style={{ opacity: 0.3 }} />
                <Text style={[styles.emptyTitle, { color: textColor }]}>No Active Payout Method</Text>
                <Text style={[styles.emptySub, { color: subtextColor }]}>
                    Add a bank account or UPI ID to receive your weekly earnings.
                </Text>
            </View>
          )}

          <View style={styles.protocolList}>
            <Text style={styles.sectionTitle}>PROTOCOL DETAILS</Text>
            <View style={[styles.protocolItem, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <View style={styles.protocolIcon}>
                <Ionicons name="time-outline" size={20} color={PRIMARY_BLUE} />
              </View>
              <View>
                <Text style={[styles.protocolLabel, { color: subtextColor }]}>NEXT SETTLEMENT</Text>
                <Text style={[styles.protocolValue, { color: textColor }]}>Monday, 04:00 PM</Text>
              </View>
            </View>
            
            <View style={[styles.protocolItem, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <View style={styles.protocolIcon}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#16A34A" />
              </View>
              <View>
                <Text style={[styles.protocolLabel, { color: subtextColor }]}>SECURITY STATUS</Text>
                <Text style={[styles.protocolValue, { color: "#16A34A" }]}>SECURED & VERIFIED</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.updateBtn} onPress={() => router.push('/add-bank')}>
             <LinearGradient colors={['#1800ad', '#2563EB']} style={styles.btnGrad}>
                <Text style={styles.updateBtnText}>{bankData ? 'MANAGE PAYOUT METHOD' : 'ADD PAYOUT METHOD'}</Text>
                <Ionicons name="settings-outline" size={20} color="#FFF" />
             </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function paymentCard(data: any) {
  const isBank = data.type === 'bank';
  const colors = data.colorScheme || ['#1E293B', '#0F172A'];

  return (
    <View style={styles.cardContainer}>
      <LinearGradient colors={colors} style={styles.debitCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.cardTop}>
          <View style={styles.chipPlaceholder}>
            <MaterialCommunityIcons name="integrated-circuit-chip" size={32} color="rgba(255,255,255,0.7)" />
          </View>
          <MaterialCommunityIcons 
            name={isBank ? "credit-card-outline" : "qrcode-scan"} 
            size={32} 
            color="rgba(255,255,255,0.4)" 
          />
        </View>

        <View style={styles.cardMid}>
          {isBank ? (
            <Text style={styles.cardNumber}>••••  ••••  ••••  {data.accNumber?.slice(-4) || '0000'}</Text>
          ) : (
            <Text style={styles.upiIdText}>{data.upiId || 'No UPI ID'}</Text>
          )}
        </View>

        <View style={styles.cardBottom}>
          <View>
            <Text style={styles.cardLabel}>ACCOUNT HOLDER</Text>
            <Text style={styles.cardValue}>{data.accHolder || 'RIDER NAME'}</Text>
          </View>
          <View style={styles.bankTag}>
            <Text style={styles.bankNameText}>{isBank ? data.bankName : 'UPI PAYOUT'}</Text>
          </View>
        </View>

        <View style={styles.circle1} />
        <View style={styles.circle2} />
      </LinearGradient>
      
      <View style={[styles.cardShadow, { backgroundColor: colors[0] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 140, backgroundColor: '#1800ad', zIndex: 100 },
  headerGradient: { ...StyleSheet.absoluteFillObject },
  headerContent: { flex: 1, paddingHorizontal: 20 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  viewBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  scrollContent: { paddingBottom: 40 },
  mainContent: { paddingHorizontal: 20, marginTop: 20 },
  
  cardContainer: { width: '100%', alignItems: 'center', marginBottom: 30 },
  debitCard: { width: width - 40, height: 210, borderRadius: 24, padding: 24, overflow: 'hidden', position: 'relative', elevation: 15 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chipPlaceholder: { width: 45, height: 35, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  cardMid: { marginTop: 40 },
  cardNumber: { color: '#FFF', fontSize: 22, fontWeight: '700', letterSpacing: 4, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  upiIdText: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 40 },
  cardLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cardValue: { color: '#FFF', fontSize: 14, fontWeight: '800', marginTop: 4 },
  bankTag: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  bankNameText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  circle1: { position: 'absolute', top: -50, right: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.05)' },
  circle2: { position: 'absolute', bottom: -30, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)' },
  cardShadow: { position: 'absolute', bottom: -10, width: '85%', height: 40, borderRadius: 20, opacity: 0.3, zIndex: -1, transform: [{ scaleX: 0.9 }] },

  emptyCard: { borderRadius: 30, padding: 40, alignItems: 'center', borderWidth: 1, ...SHADOWS.soft },
  emptyTitle: { fontSize: 18, fontWeight: '900', marginTop: 20 },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 10, lineHeight: 20, fontWeight: '600' },
  
  protocolList: { marginTop: 10 },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: COLORS.slate[400], letterSpacing: 1.5, marginBottom: 15, marginLeft: 4 },
  protocolItem: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
  protocolIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.slate[50], justifyContent: 'center', alignItems: 'center' },
  protocolLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  protocolValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },

  updateBtn: { height: 70, borderRadius: 25, overflow: 'hidden', marginTop: 10, ...SHADOWS.medium },
  btnGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  updateBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
});
