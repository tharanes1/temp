import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Dimensions, 
  KeyboardAvoidingView, 
  Platform, 
  Alert, 
  Animated 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/core/providers/UserContext';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SHADOWS, RADIUS, SPACING } from '@/shared/theme';
import BankSelectorModal from '@/features/wallet/components/BankSelectorModal';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

export default function AddBankDetails() {
  const router = useRouter();
  const { t } = useTranslation();
  const { updateBankData, bankData } = useUser();

  const [paymentType, setPaymentType] = useState<'bank' | 'upi'>(bankData?.type || 'bank');
  
  // Bank States
  const [accHolder, setAccHolder] = useState(bankData?.accHolder || '');
  const [accNumber, setAccNumber] = useState(bankData?.accNumber || '');
  const [ifsc, setIfsc] = useState(bankData?.ifsc || '');
  const [selectedBank, setSelectedBank] = useState<any>(bankData?.bankName ? { name: bankData.bankName, colors: bankData.colorScheme } : null);
  
  // UPI States
  const [upiId, setUpiId] = useState(bankData?.upiId || '');

  const [isBankModalVisible, setIsBankModalVisible] = useState(false);
  const tabAnim = useRef(new Animated.Value(paymentType === 'bank' ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(tabAnim, {
      toValue: paymentType === 'bank' ? 0 : 1,
      useNativeDriver: false,
      friction: 8,
      tension: 50
    }).start();
  }, [paymentType]);

  // Theme support
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const cardAltColor = useThemeColor({}, 'cardSecondary');
  const { darkMode } = useSettings();
  const isDark = darkMode;

  const handleSave = async () => {
    if (paymentType === 'bank') {
      if (!accHolder || !accNumber || !ifsc || !selectedBank) {
        Alert.alert('Incomplete Fields', 'Please fill all bank details including bank name.');
        return;
      }

      // Server-side persistence — POST /api/v1/wallet/bank-accounts.
      // Penny-drop verification is enqueued by the backend; the new account
      // initially shows `status: pending_verification` in BankAccountsScreen.
      try {
        const { walletService } = await import('@/services/api/features/wallet');
        await walletService.addBankAccount({
          accountHolderName: accHolder.toUpperCase().trim(),
          accountNumber: accNumber,
          confirmAccountNumber: accNumber,
          ifscCode: ifsc.toUpperCase().trim(),
          bankName: selectedBank.name,
          isPrimary: true,
        });
      } catch (e: unknown) {
        const msg = (e as { message?: string } | undefined)?.message ?? 'Could not save account';
        Alert.alert('Save failed', msg);
        return;
      }

      // Mirror into UserContext for offline-fallback rendering.
      const data = {
        type: 'bank',
        accHolder: accHolder.toUpperCase().trim(),
        accNumber,
        ifsc: ifsc.toUpperCase().trim(),
        bankName: selectedBank.name,
        colorScheme: selectedBank.colors,
      };
      updateBankData(data as any);
    } else {
      if (!upiId || !accHolder) {
        Alert.alert('Incomplete Fields', 'Please enter Account Holder Name and UPI ID.');
        return;
      }
      const data = {
        type: 'upi',
        accHolder: accHolder.toUpperCase().trim(),
        upiId: upiId.toLowerCase().trim()
      };
      updateBankData(data as any);
    }

    Alert.alert(
      'Details Saved',
      'Your payout details have been updated successfully.',
      [{ text: 'View Accounts', onPress: () => router.replace('/bank-accounts') }]
    );
  };

  const translateX = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, (width - 44) / 2 - 2]
  });

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
            <Text style={styles.headerTitle}>Payout Configuration</Text>
            <TouchableOpacity style={styles.viewBtn} onPress={() => router.push('/bank-accounts')}>
                <Ionicons name="list" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.mainContent}>
            
            {/* 🔄 SLIDING TAB */}
            <View style={[styles.tabContainer, { backgroundColor: cardAltColor, borderColor: borderColor }]}>
              <Animated.View style={[styles.tabHighlight, { transform: [{ translateX }] }]} />
              <TouchableOpacity style={styles.tabBtn} onPress={() => setPaymentType('bank')}>
                <Text style={[styles.tabText, paymentType === 'bank' && styles.tabTextActive]}>BANK ACCOUNT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tabBtn} onPress={() => setPaymentType('upi')}>
                <Text style={[styles.tabText, paymentType === 'upi' && styles.tabTextActive]}>UPI ID</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.formCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <View style={styles.sectionHeader}>
                 <Text style={[styles.sectionTitle, { color: subtextColor }]}>
                   {paymentType === 'bank' ? 'BANKING PROTOCOL' : 'DIGITAL WALLET PROTOCOL'}
                 </Text>
              </View>

              {/* COMMON: ACCOUNT HOLDER */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: subtextColor }]}>ACCOUNT HOLDER NAME</Text>
                <View style={[styles.inputWrapper, { backgroundColor: cardAltColor, borderColor: borderColor }]}>
                  <Ionicons name="person-outline" size={20} color={PRIMARY_BLUE} />
                  <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="As per legal documents"
                    placeholderTextColor={subtextColor}
                    value={accHolder}
                    onChangeText={setAccHolder}
                  />
                </View>
              </View>

              {paymentType === 'bank' ? (
                <>
                  {/* BANK SELECTOR */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: subtextColor }]}>SELECT BANK</Text>
                    <TouchableOpacity 
                      style={[styles.inputWrapper, { backgroundColor: cardAltColor, borderColor: borderColor }]}
                      onPress={() => setIsBankModalVisible(true)}
                    >
                      <MaterialCommunityIcons name="bank-transfer" size={22} color={PRIMARY_BLUE} />
                      <Text style={[styles.input, { color: selectedBank ? textColor : subtextColor }]}>
                        {selectedBank ? selectedBank.name : 'Search & Select Bank'}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color={subtextColor} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: subtextColor }]}>ACCOUNT NUMBER</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: cardAltColor, borderColor: borderColor }]}>
                      <Ionicons name="card-outline" size={20} color={PRIMARY_BLUE} />
                      <TextInput
                        style={[styles.input, { color: textColor }]}
                        placeholder="Enter full account number"
                        placeholderTextColor={subtextColor}
                        keyboardType="number-pad"
                        value={accNumber}
                        onChangeText={setAccNumber}
                        maxLength={18}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: subtextColor }]}>IFSC CODE</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: cardAltColor, borderColor: borderColor }]}>
                      <MaterialCommunityIcons name="bank-outline" size={20} color={PRIMARY_BLUE} />
                      <TextInput
                        style={[styles.input, { color: textColor }]}
                        placeholder="e.g. HDFC0001234"
                        placeholderTextColor={subtextColor}
                        autoCapitalize="characters"
                        value={ifsc}
                        onChangeText={setIfsc}
                        maxLength={11}
                      />
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: subtextColor }]}>UPI ID (VPA)</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: cardAltColor, borderColor: borderColor }]}>
                    <MaterialCommunityIcons name="qrcode-scan" size={20} color={PRIMARY_BLUE} />
                    <TextInput
                      style={[styles.input, { color: textColor }]}
                      placeholder="e.g. rider@upi"
                      placeholderTextColor={subtextColor}
                      autoCapitalize="none"
                      value={upiId}
                      onChangeText={setUpiId}
                    />
                  </View>
                  <Text style={styles.upiHint}>All payouts will be sent to this UPI ID</Text>
                </View>
              )}

              <View style={[styles.infoBox, { backgroundColor: isDark ? '#1e1b4b' : '#F8FAFC' }]}>
                 <Ionicons name="shield-checkmark" size={18} color={PRIMARY_BLUE} />
                 <Text style={[styles.infoText, { color: subtextColor }]}>
                    Your payout information is encrypted and verified for secure weekly settlements.
                 </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <LinearGradient colors={['#1800ad', '#2563EB']} style={styles.btnGrad}>
                <Text style={styles.saveBtnText}>VALIDATE & SAVE</Text>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>

            <Text style={[styles.footerText, { color: subtextColor }]}>
               Secure Payout Protocol • AES-256 Protection
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BankSelectorModal 
        visible={isBankModalVisible}
        onClose={() => setIsBankModalVisible(false)}
        onSelect={setSelectedBank}
      />
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
  
  tabContainer: { flexDirection: 'row', height: 60, borderRadius: 30, padding: 4, marginBottom: 20, borderWidth: 1, position: 'relative' },
  tabHighlight: { position: 'absolute', top: 4, bottom: 4, width: (width - 44) / 2, backgroundColor: PRIMARY_BLUE, borderRadius: 26, ...SHADOWS.medium },
  tabBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  tabText: { fontSize: 11, fontWeight: '900', color: COLORS.slate[400], letterSpacing: 1 },
  tabTextActive: { color: '#FFF' },

  formCard: { borderRadius: 30, padding: 24, marginBottom: 20, borderWidth: 1, ...SHADOWS.soft },
  sectionHeader: { marginBottom: 25 },
  sectionTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', height: 55, borderRadius: 15, borderWidth: 1, paddingHorizontal: 15, gap: 12 },
  input: { flex: 1, fontSize: 15, fontWeight: '700' },
  upiHint: { fontSize: 10, color: COLORS.slate[400], marginTop: 8, marginLeft: 4, fontWeight: '600' },
  
  infoBox: { flexDirection: 'row', padding: 15, borderRadius: 15, gap: 10, marginTop: 10 },
  infoText: { flex: 1, fontSize: 11, fontWeight: '700', lineHeight: 16 },
  saveBtn: { height: 70, borderRadius: 25, overflow: 'hidden', marginTop: 10, ...SHADOWS.medium },
  btnGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  footerText: { fontSize: 10, textAlign: 'center', marginTop: 25, fontWeight: '900', letterSpacing: 1, color: COLORS.slate[300] }
});
