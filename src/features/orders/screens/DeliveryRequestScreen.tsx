import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Image,
  Vibration
} from "react-native";
import { MapView, Marker, Polyline, PROVIDER_DEFAULT } from '@/shared/components/map/MapView';
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { useSettings } from "@/core/providers/SettingsContext";
import { useUser } from "@/core/providers/UserContext";
import { useTranslation } from "react-i18next";
import { ms, s, vs, SCREEN_WIDTH } from "@/shared/utils/responsive";
import { useDeliveryRequest } from "@/features/orders/hooks/useDeliveryRequest";

const { width } = Dimensions.get("window");
const PRIMARY_BLUE = "#1800ad";

const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#1e1b4b" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#818cf8" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#1e1b4b" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#312e81" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#0f172a" }]
  }
];

export default function DeliveryRequestScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { trackOrderAction } = useUser();
  const [timeLeft, setTimeLeft] = useState(45);
  const soundRef = useRef<Audio.Sound | null>(null);
  const appState = useRef(AppState.currentState);
  const timerRef = useRef<any>(null);
  const loopRef = useRef<any>(null);

  // Theme support
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const cardAltColor = useThemeColor({}, 'cardSecondary');
  const { darkMode } = useSettings();

  // ---------------------------------------------------------
  // SERVER-DRIVEN OFFER (replaces previous hardcoded mock).
  // The `useDeliveryRequest` hook subscribes to `order:new-request` from
  // the socket gateway and exposes the live offer + 45s countdown.  When
  // no offer is in flight (e.g., the screen is opened directly with no
  // socket event), `orderData` falls back to a neutral placeholder so
  // the UI stays renderable without a crash.
  // ---------------------------------------------------------
  const {
    offer: liveOffer,
    secondsLeft: hookSecondsLeft,
    accept: hookAccept,
    reject: hookReject,
    accepting,
  } = useDeliveryRequest();

  const orderData = liveOffer
    ? {
        orderId: liveOffer.orderId,
        baseEarnings: liveOffer.baseEarnings,
        distance: liveOffer.distance,
        time: liveOffer.estimatedTime,
        merchantRating: liveOffer.merchantRating,
        specialInstructions: liveOffer.specialInstructions,
        items: liveOffer.items.map((it, idx) => ({ id: idx + 1, ...it })),
        hubName: liveOffer.hubName,
        hubAddress: liveOffer.hubAddress,
        deliveryAddress: liveOffer.deliveryAddress,
        hubCoords: liveOffer.hubCoords,
        destCoords: liveOffer.destCoords,
        longDistanceBonus: liveOffer.longDistanceBonus,
      }
    : {
        orderId: '' as string,
        baseEarnings: 0,
        distance: 0,
        time: '—',
        merchantRating: 0,
        specialInstructions: '',
        items: [] as { id: number; name: string; qty: number; icon: string }[],
        hubName: '—',
        hubAddress: '—',
        deliveryAddress: '—',
        hubCoords: { latitude: 12.9716, longitude: 77.5946 },
        destCoords: { latitude: 12.9716, longitude: 77.5946 },
        longDistanceBonus: 0,
      };

  const longDistanceBonus = orderData.longDistanceBonus;
  const isLongDistance = orderData.distance > 3;
  const totalEarnings = (orderData.baseEarnings + longDistanceBonus).toFixed(2);

  // 1. Initial State & Sound Preloading
  useEffect(() => {
    async function loadSound() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require("../assets/notification.mp3"),
          { shouldPlay: false, volume: 1.0 },
        );
        soundRef.current = sound;
        trackOrderAction("received");
        startAlertCycle();
      } catch (error) {
        console.log("Error loading sound", error);
      }
    }
    loadSound();
    return () => {
      stopAllAlerts();
    };
  }, []);

  // 2. Alert Logic (Sound + Haptics)
  const startAlertCycle = () => {
    triggerAlert();
    loopRef.current = setInterval(() => triggerAlert(), 4000);
  };

  const triggerAlert = async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) await soundRef.current.replayAsync();
      }
      Vibration.vibrate([0, 500, 200, 500], true);
    } catch (e) {}
  };

  const stopAllAlerts = async () => {
    Vibration.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    if (loopRef.current) clearInterval(loopRef.current);
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch (e) {}
    }
  };

  // 3. Auto-Decline Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopAllAlerts();
          trackOrderAction("declined");
          router.replace("/warning");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleAccept = async () => {
    if (!orderData.orderId) {
      // No live offer yet — bail out cleanly.
      router.back();
      return;
    }
    await stopAllAlerts();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const ok = await hookAccept();
    if (!ok) {
      // Server rejected (ORDER_TAKEN, ORDER_EXPIRED, etc.) — back to warning.
      router.replace("/warning");
      return;
    }
    trackOrderAction("accepted");
    router.replace("/active-navigation");
  };

  const handleReject = async () => {
    await stopAllAlerts();
    if (orderData.orderId) {
      try {
        await hookReject('other');
      } catch {
        // best-effort: server reject failure shouldn't block the local flow
      }
    }
    trackOrderAction("declined");
    router.replace("/warning");
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>

      {/* 🔴 PREMIUM ABSOLUTE HEADER */}
      <View style={styles.headerHero}>
        <LinearGradient
          colors={["#1800ad", "#2563EB"]}
          style={styles.headerGradient}
        />

        {/* DESIGN BLOBS */}
        <View style={styles.blob1} />
        <View style={styles.blob2} />

        <SafeAreaView edges={["top"]} style={styles.headerContent}>
          <View style={styles.heroMain}>
            <View style={styles.alertIndicator}>
              <View style={styles.pulseDot} />
              <Text style={styles.alertTag}>{t('ops.new_mission')}</Text>
            </View>
            <Text style={styles.heroTitle}>{t('ops.incoming_delivery')}</Text>
            <View style={styles.timerChip}>
              <Ionicons name="time" size={16} color="#FFF" />
              <Text style={styles.timerText}>{t('ops.deciding_in', { seconds: timeLeft })}</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          {/* 🗺️ ROUTE PREVIEW MAP */}
          <View style={[styles.mapContainer, { borderColor: borderColor }]}>
            <MapView
              provider={PROVIDER_DEFAULT}
              style={styles.map}
              initialRegion={{
                latitude: (orderData.hubCoords.latitude + orderData.destCoords.latitude) / 2,
                longitude: (orderData.hubCoords.longitude + orderData.destCoords.longitude) / 2,
                latitudeDelta: 0.03,
                longitudeDelta: 0.03,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              customMapStyle={darkMode ? darkMapStyle : []}
            >
              <Marker coordinate={orderData.hubCoords}>
                <View style={[styles.miniMarker, { backgroundColor: PRIMARY_BLUE }]}>
                  <MaterialCommunityIcons name="store" size={12} color="#FFF" />
                </View>
              </Marker>
              <Marker coordinate={orderData.destCoords}>
                <View style={[styles.miniMarker, { backgroundColor: "#16A34A" }]}>
                  <MaterialCommunityIcons name="home-variant" size={12} color="#FFF" />
                </View>
              </Marker>
              <Polyline
                coordinates={[orderData.hubCoords, orderData.destCoords]}
                strokeColor={PRIMARY_BLUE}
                strokeWidth={3}
                lineDashPattern={[5, 5]}
              />
            </MapView>
            <LinearGradient
              colors={["transparent", darkMode ? "rgba(30,27,75,0.8)" : "rgba(255,255,255,0.8)"]}
              style={styles.mapOverlay}
            />
          </View>

          {/* STATS ROW */}
          <View style={[styles.statsRow, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: subtextColor }]}>{t('ops.earnings')}</Text>
              <View style={styles.earningsContainer}>
                <Text style={[styles.statValue, { color: textColor }]}>₹{totalEarnings}</Text>
                {isLongDistance && (
                  <View style={styles.bonusBadge}>
                    <Text style={styles.bonusBadgeText}>+₹{longDistanceBonus.toFixed(0)} BONUS</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: subtextColor }]}>{t('ops.distance')}</Text>
              <Text style={[styles.statValue, { color: textColor }]}>{orderData.distance} km</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: subtextColor }]}>{t('ops.time')}</Text>
              <Text style={[styles.statValue, { color: textColor }]}>{orderData.time}</Text>
            </View>
          </View>

          {/* LOCATION CARD */}
          <View style={[styles.locationCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <View style={styles.locationStep}>
              <View style={[styles.stepIcon, { backgroundColor: cardAltColor }]}>
                <MaterialCommunityIcons
                  name="silverware-fork-knife"
                  size={20}
                  color={PRIMARY_BLUE}
                />
              </View>
              <View style={styles.stepText}>
                <Text style={[styles.stepLabel, { color: subtextColor }]}>{t('ops.pickup_at')}</Text>
                <Text style={[styles.stepTitle, { color: textColor }]}>{orderData.hubName}</Text>
                <Text style={[styles.stepSub, { color: subtextColor }]}>{orderData.hubAddress}</Text>
              </View>
            </View>

            <View style={styles.locationConnector}>
              <View style={[styles.dot, { backgroundColor: borderColor }]} />
              <View style={[styles.line, { backgroundColor: borderColor }]} />
              <View style={[styles.dot, { backgroundColor: borderColor }]} />
            </View>

            <View style={styles.locationStep}>
              <View style={[styles.stepIcon, { backgroundColor: darkMode ? '#064e3b' : '#F0FDF4' }]}>
                <Ionicons name="location" size={20} color="#16A34A" />
              </View>
              <View style={styles.stepText}>
                <Text style={[styles.stepLabel, { color: subtextColor }]}>{t('ops.deliver_to')}</Text>
                <Text style={[styles.stepTitle, { color: textColor }]}>{orderData.deliveryAddress}</Text>
                <Text style={[styles.stepSub, { color: subtextColor }]}>
                  {t('ops_mock.delivery_addr')}
                </Text>
              </View>
            </View>
          </View>

          {/* 📝 SPECIAL INSTRUCTIONS */}
          <View style={[styles.instructionCard, { backgroundColor: darkMode ? '#1e1b4b' : '#FFFBEB', borderColor: darkMode ? '#312e81' : '#FEF3C7' }]}>
            <View style={styles.instructionHeader}>
              <MaterialCommunityIcons name="message-alert-outline" size={16} color="#D97706" />
              <Text style={[styles.instructionTitle, { color: "#D97706" }]}>{t('ops.special_instructions', 'Special Instructions')}</Text>
            </View>
            <Text style={[styles.instructionText, { color: darkMode ? '#fbbf24' : '#92400E' }]}>{orderData.specialInstructions}</Text>
          </View>

          {/* ACTIONS */}
          <View style={styles.actionStack}>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={handleAccept}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[PRIMARY_BLUE, "#2563EB"]}
                style={styles.btnGrad}
              >
                <Text style={styles.acceptText}>{t('ops.accept')}</Text>
                <Ionicons name="arrow-forward-circle" size={24} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.rejectBtn, { borderColor: borderColor }]} onPress={handleReject}>
              <Text style={[styles.rejectText, { color: subtextColor }]}>{t('ops.reject')}</Text>
            </TouchableOpacity>
          </View>

          {/* 📦 ORDER DETAILS (BELOW BUTTONS) */}
          <View style={[styles.orderDetailCard, { backgroundColor: cardAltColor }]}>
            <View style={styles.orderHeader}>
              <MaterialCommunityIcons name="package-variant" size={18} color={PRIMARY_BLUE} />
              <Text style={[styles.orderTitle, { color: textColor }]}>{t('ops.order_details', 'Order Contents')}</Text>
            </View>
            
            <View style={styles.itemList}>
              {orderData.items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemIconBox}>
                    <MaterialCommunityIcons name={item.icon as any} size={14} color={PRIMARY_BLUE} />
                  </View>
                  <Text style={[styles.itemQty, { color: PRIMARY_BLUE }]}>{item.qty}x</Text>
                  <Text style={[styles.itemName, { color: textColor }]}>{item.name}</Text>
                </View>
              ))}
            </View>

            {isLongDistance && (
              <View style={styles.longDistanceAlert}>
                <Ionicons name="flash" size={14} color="#D97706" />
                <Text style={styles.longDistanceText}>
                  {t('ops.long_distance_payout', 'High earnings for 3km+ delivery')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
          </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
    marginTop: vs(320),
  },
  scrollContent: {
    paddingBottom: vs(40),
  },
  headerHero: {
    height: vs(320),
    backgroundColor: PRIMARY_BLUE,
    borderBottomLeftRadius: ms(50),
    borderBottomRightRadius: ms(50),
    overflow: "hidden",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  blob1: {
    position: "absolute",
    top: -ms(40),
    right: -ms(40),
    width: ms(180),
    height: ms(180),
    borderRadius: ms(90),
    backgroundColor: "#1E293B",
    opacity: 0.15,
  },
  blob2: {
    position: "absolute",
    bottom: -ms(20),
    left: -ms(20),
    width: ms(120),
    height: ms(120),
    borderRadius: ms(60),
    backgroundColor: "#1655D9",
    opacity: 0.1,
  },
  headerContent: {
    paddingHorizontal: ms(25),
    paddingTop: vs(20),
  },
  heroMain: {
    alignItems: "center",
    gap: vs(12),
  },
  alertIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(8),
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: ms(12),
    paddingVertical: ms(6),
    borderRadius: ms(50),
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFF",
  },
  alertTag: {
    fontSize: ms(10),
    fontWeight: "900",
    color: "#FFF",
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontSize: ms(32),
    fontWeight: "900",
    color: "#FFF",
    textAlign: "center",
  },
  timerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(8),
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: ms(15),
    paddingVertical: ms(8),
    borderRadius: ms(15),
  },
  timerText: {
    fontSize: ms(12),
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 1,
  },
  mainContent: {
    flex: 1,
    marginTop: vs(20),
    paddingHorizontal: ms(25),
  },
  statsRow: {
    flexDirection: "row",
    borderRadius: ms(25),
    padding: ms(20),
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: vs(20),
    zIndex: 10,
    borderWidth: 1,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: ms(9),
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: ms(18),
    fontWeight: "900",
  },
  statDivider: {
    width: 1,
    height: vs(30),
  },
  locationCard: {
    borderRadius: ms(30),
    padding: ms(24),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
    marginBottom: vs(25),
    borderWidth: 1,
  },
  locationStep: {
    flexDirection: "row",
    gap: ms(16),
  },
  stepIcon: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(15),
    justifyContent: "center",
    alignItems: "center",
  },
  stepText: {
    flex: 1,
  },
  stepLabel: {
    fontSize: ms(9),
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: ms(18),
    fontWeight: "800",
  },
  stepSub: {
    fontSize: ms(12),
    marginTop: 2,
  },
  locationConnector: {
    marginLeft: ms(23),
    height: vs(35),
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: vs(4),
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  line: {
    width: 1,
    flex: 1,
  },
  actionStack: {
    gap: vs(12),
  },
  acceptBtn: {
    height: vs(70),
    borderRadius: ms(25),
    overflow: "hidden",
  },
  btnGrad: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: ms(15),
  },
  acceptText: {
    fontSize: ms(20),
    fontWeight: "900",
    color: "#FFF",
    letterSpacing: 1,
  },
  rejectBtn: {
    height: vs(55),
    borderRadius: ms(22),
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  rejectText: {
    fontSize: ms(12),
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  earningsContainer: {
    alignItems: 'center',
  },
  bonusBadge: {
    backgroundColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  bonusBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#92400E',
  },
  orderDetailCard: {
    marginTop: vs(20),
    borderRadius: ms(20),
    padding: ms(18),
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    marginBottom: vs(40),
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  orderTitle: {
    fontSize: ms(13),
    fontWeight: '700',
  },
  itemList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 10,
  },
  itemQty: {
    fontSize: ms(12),
    fontWeight: '800',
    width: 25,
  },
  itemName: {
    fontSize: ms(12),
    fontWeight: '500',
    opacity: 0.8,
  },
  longDistanceAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 8,
    marginTop: 15,
  },
  longDistanceText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },
  mapContainer: {
    height: vs(160),
    borderRadius: ms(25),
    overflow: 'hidden',
    marginBottom: vs(20),
    borderWidth: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  miniMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  instructionCard: {
    borderRadius: ms(20),
    padding: ms(15),
    marginBottom: vs(20),
    borderWidth: 1,
  },
  instructionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  instructionTitle: {
    fontSize: ms(11),
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  instructionText: {
    fontSize: ms(13),
    fontWeight: "600",
    lineHeight: 18,
  },
  itemIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "rgba(24, 0, 173, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
});
