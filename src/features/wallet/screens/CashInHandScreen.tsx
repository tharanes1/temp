import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { useSettings } from "@/core/providers/SettingsContext";
import { useTranslation } from "react-i18next";
import { useUser } from "@/core/providers/UserContext";
import { useWalletBalance, useCashInHand } from "@/features/wallet/hooks/useWallet";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/shared/theme";
import QRModal from "../components/QRModal";
import { useTourStore } from "@/shared/store/tourStore";
import { useSpotlightTour } from "@/shared/hooks/useSpotlightTour";

const { width } = Dimensions.get("window");
const PRIMARY_BLUE = "#1800ad";

type UPIApp = {
  id: string;
  name: string;
  scheme: string;
  logo: string;
  isInstalled: boolean;
};

export default function CashInHandScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t } = useTranslation();
  const { riderName } = useUser();
  // Server-driven cash-in-hand + balance.  The legacy `useUser().walletBalance`
  // used a single hardcoded ₹4,250.34 default; we now consume the spec's
  // four-field shape via `useWalletBalance` and the COD list via `useCashInHand`.
  const { balance: walletBalanceDto, refresh: refreshBalance } = useWalletBalance();
  const { data: cashInHandData, reconcile } = useCashInHand();
  const walletBalance = walletBalanceDto?.cashInHand ?? cashInHandData?.cashInHand ?? 0;
  const updateWalletBalance = async (delta: number) => {
    if (delta < 0) {
      try {
        await reconcile({ amount: -delta, method: 'upi_transfer' });
        await refreshBalance();
      } catch (e) {
        if (__DEV__) console.warn('Reconcile failed:', (e as Error).message);
      }
    } else {
      // Positive delta means cash collected — ordinarily this happens server-side
      // when an order is delivered.  The QR/scan flow stays as-is for now and
      // simply triggers a refresh.
      await refreshBalance();
    }
  };
  const [amount, setAmount] = useState("");
  const [qrModal, setQrModal] = useState<{ visible: boolean; mode: 'scan' | 'receive' }>({ visible: false, mode: 'scan' });
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  
  // Precision Refs
  const balanceRef = useRef<View>(null);
  const settleRef = useRef<View>(null);
  const appsRef = useRef<View>(null);

  const refs = {
    balance: balanceRef,
    settle: settleRef,
    apps: appsRef
  };

  const keys = ['balance', 'settle', 'apps'];

  const { measureAndStart } = useTourStore();

  const { onScrollBeginDrag, onMomentumScrollEnd, onLayoutTarget } = useSpotlightTour({ refs, scrollRef, keys });

  const [tourVisible, setTourVisible] = useState(params.showTour === 'true');

  useEffect(() => {
    if (!tourVisible) return;
    setTourVisible(false);
    measureAndStart([
      { title: "Cash Balance", desc: "This shows the total cash you've collected from customers that needs to be settled.", icon: "cash-outline", iconType: "Ionicons", ref: refs.balance },
      { title: "Settle Now", desc: "Use this button to quickly settle your outstanding cash balance via UPI or card.", icon: "card-outline", iconType: "Ionicons", ref: refs.settle },
      { title: "Settlement Apps", desc: "Choose your preferred payment app to complete the transaction securely.", icon: "apps-outline", iconType: "Ionicons", ref: refs.apps },
    ]);
  }, [tourVisible]);

  const [availableApps, setAvailableApps] = useState<UPIApp[]>([
    {
      id: "gpay",
      name: "GPay",
      scheme: "googlepay://", 
      logo: "https://www.vectorlogo.zone/logos/google_pay/google_pay-icon.png",
      isInstalled: false,
    },
    {
      id: "phonepe",
      name: "PhonePe",
      scheme: "phonepe://",
      logo: "https://www.vectorlogo.zone/logos/phonepe/phonepe-icon.png",
      isInstalled: false,
    },
    {
      id: "paytm",
      name: "Paytm",
      scheme: "paytmmp://",
      logo: "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/paytm-icon.png",
      isInstalled: false,
    },
    {
      id: "bhim",
      name: "BHIM",
      scheme: "bhim://",
      logo: "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/bhim-upi-icon.png",
      isInstalled: false,
    },
  ]);

  // Theme support
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const cardAltColor = useThemeColor({}, 'cardSecondary');
  const { darkMode } = useSettings();
  const isDark = darkMode;

  useEffect(() => {
    const checkApps = async () => {
      const updatedApps = await Promise.all(
        availableApps.map(async (app) => {
          try {
            if (app.id === 'gpay') {
              const tez = await Linking.canOpenURL("tez://paisa");
              const gpay = await Linking.canOpenURL("googlepay://");
              return { ...app, isInstalled: tez || gpay };
            }
            const supported = await Linking.canOpenURL(app.scheme);
            return { ...app, isInstalled: supported };
          } catch (e) {
            return { ...app, isInstalled: true }; 
          }
        }),
      );
      setAvailableApps(updatedApps);
    };
    checkApps();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.back();
        return true;
      };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => backHandler.remove();
    }, [router])
  );

  const handleWithdraw = async (app: UPIApp) => {
    const numAmt = parseFloat(amount);
    if (!amount || isNaN(numAmt) || numAmt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to withdraw.');
      return;
    }
    if (numAmt > walletBalance) {
      Alert.alert('Insufficient Balance', 'You do not have enough funds for this withdrawal.');
      return;
    }

    try {
      await Linking.openURL(app.scheme);
      updateWalletBalance(-numAmt);
      Alert.alert(
        'Settlement Initiated',
        `Successfully requested ₹${numAmt} via ${app.name}.`,
        [{ text: "DONE", onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert('Error', 'Unable to launch payment app.');
    }
  };

  const handlePaymentSuccess = (amt: number) => {
    updateWalletBalance(amt);
    Alert.alert('Wallet Updated', `₹${amt} has been successfully transacted to your wallet.`);
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
          <ScrollView 
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => {
              const y = e.nativeEvent.contentOffset.y;
              scrollY.current = y;
            }}
            onScrollBeginDrag={onScrollBeginDrag}
            onMomentumScrollEnd={onMomentumScrollEnd}
          >
            {/* 🔴 HEADER (Now inside ScrollView) */}
            <View style={styles.headerHero}>
              <LinearGradient colors={["#1800ad", "#2563EB"]} style={styles.headerGradient} />
              <SafeAreaView edges={["top"]} style={styles.headerContent}>
                <View style={styles.navRow}>
                  <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                  </TouchableOpacity>
                  <Text style={styles.headerTitleText}>Rider Wallet</Text>
                  <View style={{ width: 44 }} />
                </View>

                <View 
                  ref={balanceRef}
                  onLayout={onLayoutTarget('balance')}
                  style={styles.heroMain}
                >
                  <Text style={styles.heroTag}>COD SETTLEMENTS & PAYOUTS</Text>
                  <Text style={styles.balanceValue}>₹{walletBalance.toLocaleString()}</Text>
                  <Text style={styles.balanceLabel}>TOTAL CASH IN HAND</Text>
                </View>

                {/* ⚡ QUICK ACTIONS (QR FEATURES) */}
                <View 
                  ref={settleRef}
                  onLayout={onLayoutTarget('settle')}
                  style={styles.actionRow}
                >
                  <TouchableOpacity 
                    style={styles.actionBtn} 
                    onPress={() => setQrModal({ visible: true, mode: 'receive' })}
                  >
                     <View style={styles.actionIconBox}>
                        <MaterialCommunityIcons name="qrcode-edit" size={24} color="#FFF" />
                     </View>
                     <Text style={styles.actionText}>MY QR</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.actionDivider} />
                  
                  <TouchableOpacity 
                    style={styles.actionBtn} 
                    onPress={() => setQrModal({ visible: true, mode: 'scan' })}
                  >
                     <View style={styles.actionIconBox}>
                        <MaterialCommunityIcons name="qrcode-scan" size={24} color="#FFF" />
                     </View>
                     <Text style={styles.actionText}>SCAN QR</Text>
                  </TouchableOpacity>
                </View>
              </SafeAreaView>
            </View>
          <View style={[styles.formCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: subtextColor }]}>WITHDRAWAL SETTLEMENT</Text>
              <View style={[styles.inputWrapper, { borderBottomColor: borderColor }]}>
                <Text style={[styles.currencyPrefix, { color: textColor }]}>₹</Text>
                <TextInput
                  style={[styles.amountInput, { color: textColor }]}
                  placeholder="0.00"
                  placeholderTextColor={subtextColor}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
              <View style={styles.quickAmtRow}>
                {[1000, 2000, 5000].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={[styles.amtChip, { backgroundColor: cardAltColor, borderColor: borderColor }]}
                    onPress={() => setAmount(amt.toString())}
                  >
                    <Text style={[styles.amtChipText, { color: subtextColor }]}>+₹{amt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View 
              ref={appsRef}
              onLayout={onLayoutTarget('apps')}
              style={styles.section}
            >
              <Text style={[styles.sectionLabel, { color: subtextColor }]}>CHOOSE SETTLEMENT APP</Text>
              <View style={styles.appsGrid}>
                {availableApps.map((app) => (
                  <TouchableOpacity
                    key={app.id}
                    style={styles.appCircleItem}
                    onPress={() => handleWithdraw(app)}
                  >
                    <View style={[styles.appLogoWrapper, { backgroundColor: '#FFF', borderColor: borderColor }]}>
                      <Image source={{ uri: app.logo }} style={styles.appLogo} resizeMode="contain" />
                    </View>
                    <Text style={[styles.appName, { color: textColor }]}>{app.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.securityBox, { backgroundColor: isDark ? '#064e3b' : '#F0FDF4' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#16A34A" />
              <Text style={[styles.securityText, { color: isDark ? '#4ade80' : '#166534' }]}>
                SECURE FINANCIAL PROTOCOL ACTIVE
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <QRModal 
        visible={qrModal.visible}
        initialMode={qrModal.mode}
        onClose={() => setQrModal({ ...qrModal, visible: false })}
        onSuccess={handlePaymentSuccess}
        riderId={riderName?.replace(/\s/g, '_') || 'rider_42'}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerHero: { height: 380, backgroundColor: PRIMARY_BLUE, borderBottomLeftRadius: 50, borderBottomRightRadius: 50, overflow: 'hidden' },
  headerGradient: { ...StyleSheet.absoluteFillObject },
  headerContent: { paddingHorizontal: 25 },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 15 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  headerTitleText: { fontSize: 18, fontWeight: "900", color: "#FFF" },
  heroMain: { marginTop: 10, alignItems: "center", gap: 4 },
  heroTag: { fontSize: 10, fontWeight: "900", color: "rgba(255,255,255,0.6)", letterSpacing: 2 },
  balanceLabel: { fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.8)", letterSpacing: 2, marginTop: 5 },
  balanceValue: { fontSize: 48, fontWeight: "900", color: "#FFF" },
  
  actionRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 25, marginTop: 30, padding: 15, alignItems: 'center' },
  actionBtn: { flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 },
  actionIconBox: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  actionText: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  actionDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },

  scrollContent: { paddingHorizontal: 25, paddingTop: 0, paddingBottom: 100 },
  formCard: { borderRadius: 30, padding: 24, ...SHADOWS.medium, marginTop: -40, backgroundColor: '#FFF' },
  section: { marginBottom: 35 },
  sectionLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, marginBottom: 20, textAlign: "center" },
  inputWrapper: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderBottomWidth: 2, paddingBottom: 10, marginHorizontal: 20 },
  currencyPrefix: { fontSize: 36, fontWeight: "900", marginRight: 10 },
  amountInput: { fontSize: 36, fontWeight: "900", minWidth: 100, textAlign: 'center' },
  quickAmtRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 20 },
  amtChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  amtChipText: { fontSize: 12, fontWeight: "800" },
  appsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 20, paddingHorizontal: 10 },
  appCircleItem: { width: (width - 150) / 2, alignItems: "center", gap: 12 },
  appLogoWrapper: { width: 74, height: 74, borderRadius: 20, justifyContent: "center", alignItems: "center", borderWidth: 1, ...SHADOWS.soft, padding: 12 },
  appLogo: { width: "100%", height: "100%" },
  appName: { fontSize: 13, fontWeight: "800" },
  securityBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 15, marginTop: 10 },
  securityText: { fontSize: 11, fontWeight: "700" },
});
