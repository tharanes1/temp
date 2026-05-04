import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState, useRef } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useUser } from '@/core/providers/UserContext';
import { useTranslation } from 'react-i18next';
import { ms, vs } from '@/shared/utils/responsive';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING, RADIUS } from '@/shared/theme';
import { useTourStore } from '@/shared/store/tourStore';
import { useSpotlightTour } from '@/shared/hooks/useSpotlightTour';
import { useActiveOrder } from '@/features/orders/hooks/useActiveOrder';
import { useOrderHistory } from '@/features/orders/hooks/useOrderHistory';

const { width } = Dimensions.get('window');

interface MissionRequest {
  id: string;
  restaurant: string;
  address: string;
  earnings: string;
  distance: string;
  timeLeft: number;
}

interface CompletedMission {
  id: string;
  restaurant: string;
  date: string;
  amount: string;
  status: 'Delivered' | 'Cancelled';
}

// HISTORY_MOCK removed — history now sourced from `/api/v1/orders/history` via
// `useOrderHistory`.  Active missions come from `/api/v1/orders/active`.

export default function OrdersScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const tabBarHeight = useBottomTabBarHeight();
  const { isOnline } = useUser();
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [missions, setMissions] = useState<MissionRequest[]>([]);
  const rotation = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);

  // Precision Refs for Absolute Measurement
  const refs = {
    tabs: useRef<View>(null),
    list: useRef<View>(null),
    scanner: useRef<View>(null),
    history: useRef<View>(null),
  };

  const keys = ['tabs', 'list', 'scanner', 'history'];

  const { measureAndStart } = useTourStore();

  const { onScrollBeginDrag, onMomentumScrollEnd, onLayoutTarget } = useSpotlightTour({ refs, scrollRef, keys });

  const [tourVisible, setTourVisible] = useState(params.showTour === 'true');

  useEffect(() => {
    if (!tourVisible) return;
    setTourVisible(false);
    measureAndStart([
      { title: "Navigation Tabs", desc: "Toggle between active missions and your completed delivery history.", icon: "swap-horizontal", iconType: "Ionicons", ref: refs.tabs },
      { title: "Active Missions", desc: "This is where all incoming delivery requests appear. Tap 'Accept' within 30 seconds.", icon: "cube-outline", iconType: "Ionicons", ref: refs.list },
      { title: "Live Scanner", desc: "While online, the system continuously scans for high-priority missions near you.", icon: "satellite-variant", iconType: "MaterialCommunityIcons", ref: refs.scanner },
      { title: "Mission History", desc: "Review your past deliveries, including earnings per order and delivery status.", icon: "history", iconType: "MaterialCommunityIcons", ref: refs.history },
    ]);
  }, [tourVisible]);

  // Server-driven active order — replaces the previous `seedMissions` fake.
  // The `useActiveOrder` hook fetches /orders/active on mount and re-pulls
  // when an `order:status-updated` event arrives over the socket.
  const { order: activeOrderDto } = useActiveOrder();
  const { items: history } = useOrderHistory();

  useEffect(() => {
    if (activeOrderDto) {
      const totalRupees = activeOrderDto.totalEarnings ?? activeOrderDto.baseEarnings;
      const m: MissionRequest = {
        id: activeOrderDto.id,
        restaurant: activeOrderDto.hubName,
        address: activeOrderDto.deliveryAddress,
        earnings: totalRupees.toFixed(2),
        distance: `${activeOrderDto.distance.toFixed(1)} km`,
        timeLeft: 0, // post-acceptance: no offer countdown
      };
      setMissions([m]);
    } else {
      setMissions([]);
    }
  }, [activeOrderDto]);

  useEffect(() => {
    if (isOnline && missions.length === 0 && activeTab === 'active') {
      rotation.value = withRepeat(withTiming(360, { duration: 4000, easing: Easing.linear }), -1, false);
    } else {
      rotation.value = 0;
    }
  }, [isOnline, missions.length, activeTab]);

  const scannerStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  // The active-order tile in this screen represents an already-accepted
  // order, so tapping it just routes the rider to the navigation screen.
  // Pre-acceptance offers are handled by DeliveryRequestScreen via the
  // `order:new-request` socket event.
  const handleAccept = (_id: string) => {
    router.replace('/active-navigation');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar style="light" />
      
      <ScrollView 
        ref={scrollRef}
        showsVerticalScrollIndicator={false} 
        scrollEventThrottle={16}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          scrollY.current = y;
        }}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 30 }]}
        bounces={true}
      >
        {/* 🔴 PREMIUM HEADER */}
        <View style={styles.headerHero}>
          <LinearGradient
            colors={['#1800ad', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          />
          <View style={styles.blob1} />
          <View style={styles.blob2} />

          <SafeAreaView edges={['top']} style={styles.headerContent}>
            <View style={styles.navRow}>
               <TouchableOpacity style={styles.iconBtn} onPress={() => router.replace('/(tabs)')}>
                  <Ionicons name="arrow-back" size={24} color="#FFF" />
               </TouchableOpacity>
               <View style={styles.headerTitleBox}>
                  <Text style={styles.partnerTag}>{t('orders.mission_center')}</Text>
               </View>
               <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/delivery-request')}>
                  <MaterialCommunityIcons name="broadcast" size={24} color={isOnline ? '#4ADE80' : 'rgba(255,255,255,0.4)'} />
               </TouchableOpacity>
            </View>

            <View 
               style={styles.heroMain} 
               ref={refs.tabs}
               onLayout={onLayoutTarget('tabs')}
            >
               <Text style={styles.mainTitle}>{t('orders.mission_hub')}</Text>
               
               {/* 🔘 UNIFIED TAB SELECTOR */}
               <View style={styles.tabContainer}>
                  <TouchableOpacity 
                    style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]} 
                    onPress={() => setActiveTab('active')}
                  >
                     <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>{t('orders.active')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]} 
                    onPress={() => setActiveTab('history')}
                  >
                     <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>{t('orders.history')}</Text>
                  </TouchableOpacity>
               </View>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.mainContent}>
          {activeTab === 'active' ? (
             <View>
                {!isOnline ? (
                   <View style={styles.emptyState}>
                      <View style={[styles.radarPlaceholder, { ...SHADOWS.soft }]}>
                         <MaterialCommunityIcons name="power-sleep" size={48} color={COLORS.slate[400]} />
                      </View>
                      <Text style={styles.emptyTitle}>{t('orders.operational_pause')}</Text>
                      <Text style={styles.emptySub}>{t('orders.pause_sub')}</Text>
                   </View>
                ) : missions.length === 0 ? (
                    <View style={styles.emptyState} ref={refs.scanner} onLayout={onLayoutTarget('scanner')}>
                       <View style={styles.radarActive}>
                         <Animated.View style={[styles.scannerLine, scannerStyle]} />
                         <MaterialCommunityIcons name="satellite-variant" size={40} color="#FFF" />
                      </View>
                      <Text style={styles.emptyTitle}>{t('orders.scanning')}</Text>
                      <Text style={styles.emptySub}>{t('orders.scanning_sub')}</Text>
                   </View>
                ) : (
                   <View style={styles.listSection} ref={refs.list} onLayout={onLayoutTarget('list')}>
                      <Text style={styles.sectionLabel}>{t('orders.detected_missions')} ({missions.length})</Text>
                      {missions.map((mission) => (
                        <View key={mission.id} style={[styles.missionCard, { ...SHADOWS.medium }]}>
                           <View style={styles.cardTop}>
                              <View style={styles.timerBadge}>
                                 <Ionicons name="stopwatch-outline" size={14} color={COLORS.error} />
                                 <Text style={styles.timerTag}>{Math.floor(mission.timeLeft / 60)}:{(mission.timeLeft % 60).toString().padStart(2, '0')}</Text>
                              </View>
                              <Text style={styles.earningsValue}>₹{mission.earnings}</Text>
                           </View>

                           <View style={styles.cardBody}>
                              <View style={styles.restIconBox}>
                                 <MaterialCommunityIcons name="storefront-outline" size={22} color={COLORS.primary} />
                              </View>
                              <View style={styles.restInfo}>
                                 <Text style={styles.restName}>{mission.restaurant}</Text>
                                 <Text style={styles.restAddr}>{mission.address}</Text>
                              </View>
                              <View style={styles.distBadge}>
                                 <Text style={styles.distText}>{mission.distance}</Text>
                              </View>
                           </View>

                           <View style={styles.cardActions}>
                              <TouchableOpacity style={styles.declineBtn} activeOpacity={0.7}>
                                 <Text style={styles.declineTxt}>{t('orders.ignore')}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.acceptBtn} activeOpacity={0.8} onPress={() => handleAccept(mission.id)}>
                                 <Text style={styles.acceptTxt}>{t('orders.accept_mission')}</Text>
                              </TouchableOpacity>
                           </View>
                        </View>
                      ))}
                   </View>
                )}
             </View>
          ) : (
             <View 
               style={styles.listSection} 
               ref={refs.history}
               onLayout={onLayoutTarget('history')}
             >
                <Text style={styles.sectionLabel}>{t('orders.recent_missions')}</Text>
                <View style={[styles.historyList, { ...SHADOWS.soft }]}>
                   {history.length === 0 ? (
                     <View style={styles.historyItem}>
                       <Text style={styles.hSub}>{t('orders.no_history') || 'No deliveries yet.'}</Text>
                     </View>
                   ) : (
                     history.map((m, idx) => {
                       const dateStr = m.deliveredAt
                         ? new Date(m.deliveredAt).toLocaleString('en-IN')
                         : new Date(m.createdAt).toLocaleString('en-IN');
                       const statusKey = m.status === 'delivered' ? 'delivered' : 'cancelled';
                       const statusColor = m.status === 'delivered' ? COLORS.success : COLORS.error;
                       const shortId = m.id.slice(0, 8);
                       return (
                         <View key={m.id} style={styles.historyWrapper}>
                           <View style={styles.historyItem}>
                             <View style={[styles.hStatusDot, { backgroundColor: statusColor }]} />
                             <View style={styles.hInfo}>
                               <Text style={styles.hTitle}>{m.hubName}</Text>
                               <Text style={styles.hSub}>{dateStr} • ID: {shortId}</Text>
                             </View>
                             <View style={styles.hValue}>
                               <Text style={styles.hAmt}>₹{m.totalEarnings.toFixed(2)}</Text>
                               <Text style={[styles.hResult, { color: statusColor }]}>
                                 {t(`orders.${statusKey}`) || statusKey}
                               </Text>
                             </View>
                           </View>
                           {idx < history.length - 1 && <View style={styles.divider} />}
                         </View>
                       );
                     })
                   )}
                </View>
             </View>
          )}
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.slate[50],
  },
  scrollContent: {
    paddingTop: 0,
  },
  headerHero: {
    height: vs(240),
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: ms(45),
    borderBottomRightRadius: ms(45),
    overflow: 'hidden',
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
    paddingHorizontal: SPACING.l,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.m,
  },
  iconBtn: {
    width: ms(44),
    height: ms(44),
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  partnerTag: {
    ...TYPOGRAPHY.tag,
    color: '#FFF',
    opacity: 0.8,
  },
  heroMain: {
    marginTop: SPACING.l,
    gap: SPACING.m,
  },
  mainTitle: {
    ...TYPOGRAPHY.hero,
    color: '#FFF',
    fontSize: ms(30),
  },
  tabContainer: {
     flexDirection: 'row',
     backgroundColor: 'rgba(0,0,0,0.1)',
     padding: 4,
     borderRadius: RADIUS.md,
  },
  tabBtn: {
     flex: 1,
     paddingVertical: SPACING.s,
     alignItems: 'center',
     borderRadius: RADIUS.md,
  },
  tabBtnActive: {
     backgroundColor: '#FFF',
  },
  tabText: {
     ...TYPOGRAPHY.tag,
     color: 'rgba(255,255,255,0.6)',
  },
  tabTextActive: {
     color: COLORS.primary,
  },
  mainContent: {
    paddingHorizontal: SPACING.l,
    marginTop: SPACING.l,
  },
  emptyState: {
     alignItems: 'center',
     paddingTop: SPACING.xl,
  },
  radarPlaceholder: {
     width: ms(140),
     height: ms(140),
     borderRadius: ms(70),
     backgroundColor: '#FFF',
     justifyContent: 'center',
     alignItems: 'center',
     marginBottom: SPACING.l,
     borderWidth: 1,
     borderColor: COLORS.slate[100],
  },
  radarActive: {
     width: ms(180),
     height: ms(180),
     borderRadius: ms(90),
     backgroundColor: COLORS.secondary,
     justifyContent: 'center',
     alignItems: 'center',
     marginBottom: SPACING.l,
     overflow: 'hidden',
     borderWidth: 3,
     borderColor: COLORS.primary,
  },
  scannerLine: {
     position: 'absolute',
     width: '100%',
     height: 2,
     backgroundColor: 'rgba(255,255,255,0.3)',
     top: '50%',
  },
  emptyTitle: {
     ...TYPOGRAPHY.h2,
     color: COLORS.black,
     marginBottom: 8,
  },
  emptySub: {
     ...TYPOGRAPHY.body,
     color: COLORS.slate[500],
     textAlign: 'center',
     paddingHorizontal: SPACING.l,
  },
  listSection: {
     gap: SPACING.m,
  },
  sectionLabel: {
    ...TYPOGRAPHY.tag,
    color: COLORS.slate[400],
    marginBottom: 4,
  },
  missionCard: {
     backgroundColor: '#FFF',
     borderRadius: RADIUS.lg,
     padding: SPACING.m,
     marginBottom: SPACING.s,
     borderWidth: 1,
     borderColor: COLORS.slate[100],
  },
  cardTop: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     marginBottom: SPACING.m,
  },
  timerBadge: {
     flexDirection: 'row',
     alignItems: 'center',
     gap: 6,
     backgroundColor: '#FEF2F2',
     paddingHorizontal: 10,
     paddingVertical: 4,
     borderRadius: 8,
  },
  timerTag: {
     color: COLORS.error,
     ...TYPOGRAPHY.tag,
  },
  earningsValue: {
     ...TYPOGRAPHY.h1,
     fontSize: ms(24),
  },
  cardBody: {
     flexDirection: 'row',
     alignItems: 'center',
     gap: SPACING.m,
     marginBottom: SPACING.l,
  },
  restIconBox: {
     width: ms(48),
     height: ms(48),
     borderRadius: RADIUS.md,
     backgroundColor: COLORS.slate[50],
     justifyContent: 'center',
     alignItems: 'center',
     borderWidth: 1,
     borderColor: COLORS.slate[100],
  },
  restInfo: {
     flex: 1,
  },
  restName: {
     ...TYPOGRAPHY.bodyLarge,
  },
  restAddr: {
     ...TYPOGRAPHY.body,
     color: COLORS.slate[400],
     marginTop: 2,
  },
  distBadge: {
     backgroundColor: COLORS.slate[100],
     paddingHorizontal: 10,
     paddingVertical: 4,
     borderRadius: 8,
  },
  distText: {
     ...TYPOGRAPHY.tag,
     fontSize: 9,
     color: COLORS.slate[600],
  },
  cardActions: {
     flexDirection: 'row',
     gap: SPACING.s,
  },
  declineBtn: {
     flex: 1,
     height: vs(50),
     borderRadius: RADIUS.md,
     borderWidth: 1.5,
     borderColor: COLORS.slate[100],
     justifyContent: 'center',
     alignItems: 'center',
  },
  declineTxt: {
     ...TYPOGRAPHY.tag,
     color: COLORS.slate[400],
  },
  acceptBtn: {
     flex: 2,
     height: vs(50),
     backgroundColor: COLORS.primary,
     borderRadius: RADIUS.md,
     justifyContent: 'center',
     alignItems: 'center',
     ...SHADOWS.soft,
  },
  acceptTxt: {
     color: '#FFF',
     ...TYPOGRAPHY.bodyLarge,
     fontSize: 14,
  },
  historyList: {
     backgroundColor: '#FFF',
     borderRadius: RADIUS.lg,
     padding: SPACING.xs,
     borderWidth: 1,
     borderColor: COLORS.slate[100],
  },
  historyWrapper: {
     // For divider logic
  },
  historyItem: {
     flexDirection: 'row',
     alignItems: 'center',
     padding: SPACING.m,
  },
  hStatusDot: {
     width: 8,
     height: 8,
     borderRadius: 4,
     marginRight: SPACING.m,
  },
  hInfo: {
     flex: 1,
  },
  hTitle: {
     ...TYPOGRAPHY.bodyLarge,
  },
  hSub: {
     ...TYPOGRAPHY.body,
     color: COLORS.slate[400],
     marginTop: 3,
  },
  hValue: {
     alignItems: 'flex-end',
  },
  hAmt: {
     ...TYPOGRAPHY.bodyLarge,
     fontWeight: '900',
  },
  hResult: {
     ...TYPOGRAPHY.tag,
     fontSize: 8,
     marginTop: 3,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.slate[50],
    marginHorizontal: SPACING.m,
  },
  decorImg: {
    width: '100%',
    height: '100%',
  },
});
