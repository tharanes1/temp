import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Switch,
  Image,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SHADOWS, SPACING, RADIUS } from '@/shared/theme';
import { ms, vs } from '@/shared/utils/responsive';
import { useTourStore } from "@/shared/store/tourStore";
import { useSpotlightTour } from '@/shared/hooks/useSpotlightTour';

/** Convert "08:00 AM" / "05:00 PM" → "08:00" / "17:00". */
function to24h(label: string): string {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label.trim());
  if (!m) return label.length === 5 ? label : '08:00';
  let h = Number.parseInt(m[1]!, 10);
  const min = m[2]!;
  const ap = m[3]!.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

/** Inverse of `to24h` for display in the existing UI. */
function format12h(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  let h = Number.parseInt(m[1]!, 10);
  const min = m[2]!;
  const ap = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, '0')}:${min} ${ap}`;
}

const { width } = Dimensions.get('window');

export default function ShiftsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const tabBarHeight = useBottomTabBarHeight();
  const scrollRef = useRef<ScrollView>(null);
  
  const [presets, setPresets] = useState({
    morning: true,
    afternoon: false,
    night: true
  });
  const [window, setWindow] = useState({
    start: '08:00 AM',
    end: '05:00 PM'
  });

  // ─── Server-driven preferences (alignment review §15) ──────────
  // Server is the source of truth.  AsyncStorage stays as offline cold-start
  // cache — it gets overwritten the moment the GET resolves.
  useEffect(() => {
    let cancelled = false;
    const loadPlanner = async () => {
      // 1) Cold-start fallback first so the UI has something to render.
      try {
        const savedPresets = await AsyncStorage.getItem('@shift_presets');
        const savedWindow = await AsyncStorage.getItem('@shift_window');
        if (!cancelled && savedPresets) setPresets(JSON.parse(savedPresets));
        if (!cancelled && savedWindow) setWindow(JSON.parse(savedWindow));
      } catch {
        // ignore — the API call below is the source of truth
      }

      // 2) Authoritative read from /api/v1/shifts/preferences.
      try {
        const { shiftsService } = await import('@/services/api/features/shifts');
        const prefs = await shiftsService.getPreferences();
        if (cancelled) return;
        setPresets(prefs.presets);
        setWindow({
          // Server returns 24h "HH:mm"; the screen's UI renders "08:00 AM" style.
          start: format12h(prefs.customWindow.start),
          end: format12h(prefs.customWindow.end),
        });
      } catch (e) {
        if (__DEV__) console.warn('shifts: GET /preferences failed', (e as Error).message);
      }
    };
    void loadPlanner();
    return () => {
      cancelled = true;
    };
  }, []);

  const onUpdatePlanner = async () => {
    try {
      // 1) Local cache so the rider sees the change immediately on reload even
      //    if they're offline at this moment.
      await AsyncStorage.setItem('@shift_presets', JSON.stringify(presets));
      await AsyncStorage.setItem('@shift_window', JSON.stringify(window));

      // 2) Server-side persistence — PUT /api/v1/shifts/preferences.
      try {
        const { shiftsService } = await import('@/services/api/features/shifts');
        await shiftsService.setPreferences({
          presets,
          customWindow: {
            start: to24h(window.start),
            end: to24h(window.end),
          },
        });
      } catch (e) {
        if (__DEV__) console.warn('shifts: PUT /preferences failed', (e as Error).message);
        // Best-effort — local cache is already saved; the rider sees the
        // change locally and the next focus refreshes from the server.
      }

      router.push('/shift-success');
    } catch (e) {
      if (__DEV__) console.warn('Failed to update planner:', (e as Error).message);
    }
  };

  const getActiveShifts = () => {
    const active = [];
    if (presets.morning) active.push({ name: t('shifts.morning_shift'), time: "06:00 AM - 12:00 PM", icon: "weather-sunset-up" });
    if (presets.afternoon) active.push({ name: t('shifts.afternoon_slot'), time: "12:00 PM - 06:00 PM", icon: "weather-sunny" });
    if (presets.night) active.push({ name: t('shifts.late_night'), time: "06:00 PM - 12:00 AM", icon: "moon-waning-crescent" });
    return active;
  };

  const activeShifts = getActiveShifts();

  const scrollY = useRef(0);

  // Precision Refs for Absolute Measurement
  const refs = {
    header: useRef<View>(null),
    window: useRef<View>(null),
    presets: useRef<View>(null),
    projection: useRef<View>(null),
  };

  const keys = ['header', 'window', 'presets', 'projection'];

  const { measureAndStart } = useTourStore();

  const { onScrollBeginDrag, onMomentumScrollEnd, onLayoutTarget } = useSpotlightTour({ refs, scrollRef, keys });

  const [tourVisible, setTourVisible] = useState(params.showTour === 'true');

  useEffect(() => {
    if (!tourVisible) return;
    setTourVisible(false);
    measureAndStart([
      { title: "Schedule Hub", desc: "Your central command for all shift bookings. Monitor your status and shift counts here.", icon: "calendar-outline", iconType: "Ionicons", ref: refs.header },
      { title: "Peak Window", desc: "Shows upcoming high-demand slots. Tap 'Book Shift' to secure your spot early.", icon: "time-outline", iconType: "Ionicons", ref: refs.window },
      { title: "Auto Presets", desc: "Quick-book your favorite shift patterns with a single tap using these saved presets.", icon: "flash-outline", iconType: "Ionicons", ref: refs.presets },
      { title: "Demand Projection", desc: "AI-driven demand forecast. Aim for higher intensity zones for maximum earnings.", icon: "trending-up", iconType: "Ionicons", ref: refs.projection },
    ]);
  }, [tourVisible]);

  return (
    <SafeAreaView style={[styles.container]} edges={['bottom']}>
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

          <View ref={refs.header}>
            <SafeAreaView 
              edges={['top']} 
              style={styles.headerContent} 
              onLayout={onLayoutTarget('header')}
            >
              <View style={styles.navRow}>
                 <TouchableOpacity style={styles.iconBtn} onPress={() => router.replace('/(tabs)')}>
                    <Ionicons name="arrow-back" size={22} color="#FFF" />
                 </TouchableOpacity>
                 <View style={styles.headerTitleBox}>
                    <Text style={styles.partnerTag}>{t('shifts.partner_account')}</Text>
                 </View>
                 <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings')}>
                    <MaterialCommunityIcons name="cog-outline" size={22} color="#FFF" />
                 </TouchableOpacity>
              </View>

              <View style={styles.heroMain}>
                 <Text style={styles.mainTitle}>{t('shifts.shift_planner')}</Text>
                 <Text style={styles.subTitle}>{t('shifts.planner_sub')}</Text>
              </View>
            </SafeAreaView>
          </View>
        </View>

        <View style={styles.mainContent}>
          
          {/* 🔘 CUSTOM WINDOW SECTION */}
          <View 
            style={styles.section} 
            ref={refs.window}
            onLayout={onLayoutTarget('window')}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('shifts.custom_window')}</Text>
            </View>
            <View style={[styles.whiteCard, { ...SHADOWS.soft }]}>
              <View style={styles.timeSelectionRow}>
                 <View style={styles.timeInput}>
                    <Text style={styles.timeLabel}>{t('shifts.start_mission')}</Text>
                    <TouchableOpacity style={styles.timeSelector}>
                       <Text style={styles.timeValue}>{window.start}</Text>
                       <Ionicons name="chevron-down" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                 </View>
                 <View style={styles.timeInput}>
                    <Text style={styles.timeLabel}>{t('shifts.end_mission')}</Text>
                    <TouchableOpacity style={styles.timeSelector}>
                       <Text style={styles.timeValue}>{window.end}</Text>
                       <Ionicons name="chevron-down" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                 </View>
              </View>
            </View>
          </View>

          {/* 🔘 SHIFT PRESETS SECTION */}
          <View 
            style={styles.section} 
            ref={refs.presets}
            onLayout={onLayoutTarget('presets')}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('shifts.logistics_presets')}</Text>
            </View>
            <View style={[styles.whiteCardList, { ...SHADOWS.medium }]}>
               <ShiftPreset 
                  icon="weather-sunset-up" 
                  name={t('shifts.morning_shift')} 
                  time="06:00 AM - 12:00 PM" 
                  value={presets.morning}
                  onToggle={(val: any) => setPresets({...presets, morning: val})}
               />
               <View style={styles.divider} />
               <ShiftPreset 
                  icon="weather-sunny" 
                  name={t('shifts.afternoon_slot')} 
                  time="12:00 PM - 06:00 PM" 
                  value={presets.afternoon}
                  onToggle={(val: any) => setPresets({...presets, afternoon: val})}
               />
               <View style={styles.divider} />
               <ShiftPreset 
                  icon="moon-waning-crescent" 
                  name={t('shifts.late_night')} 
                  time="06:00 PM - 12:00 AM" 
                  value={presets.night}
                  onToggle={(val: any) => setPresets({...presets, night: val})}
               />
            </View>
          </View>

          {/* 🔘 ACTIVE SCHEDULE SUMMARY */}
          {activeShifts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('shifts.active_schedule', 'ACTIVE SCHEDULE')}</Text>
              </View>
              <View style={[styles.activeScheduleCard, { ...SHADOWS.soft }]}>
                {activeShifts.map((shift, idx) => (
                  <View key={idx} style={styles.activeShiftRow}>
                    <View style={styles.activeShiftIcon}>
                       <MaterialCommunityIcons name={shift.icon as any} size={16} color={COLORS.primary} />
                    </View>
                    <View style={styles.activeShiftInfo}>
                       <Text style={styles.activeShiftName}>{shift.name}</Text>
                       <Text style={styles.activeShiftTime}>{shift.time}</Text>
                    </View>
                    {idx < activeShifts.length - 1 && <View style={styles.activeSeparator} />}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 🔘 REVENUE PROJECTION */}
          <View 
            style={styles.section} 
            ref={refs.projection}
            onLayout={onLayoutTarget('projection')}
          >
            <View style={styles.earningsCard}>
               <LinearGradient colors={['#064E3B', '#065F46']} style={styles.projGradient}>
                  <View style={styles.projLeft}>
                     <Text style={styles.projTag}>{t('shifts.max_estimate')}</Text>
                     <Text style={styles.projAmount}>₹140 - ₹220</Text>
                     <Text style={styles.projSub}>{t('shifts.projection_sub')}</Text>
                  </View>
                  <View style={styles.projBadge}>
                     <MaterialCommunityIcons name="trending-up" size={16} color="#FFF" />
                     <Text style={styles.projBadgeText}>{t('shifts.high_demand')}</Text>
                  </View>
               </LinearGradient>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.saveBtn} 
            activeOpacity={0.8}
            onPress={onUpdatePlanner}
          >
             <Text style={styles.saveBtnText}>{t('shifts.update_planner')}</Text>
          </TouchableOpacity>

          <Text style={styles.versionTag}>{t('shifts.version_info', { version: '4.2.0' })}</Text>
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

function ShiftPreset({ icon, name, time, value, onToggle }: any) {
   return (
      <View style={styles.presetItem}>
         <View style={styles.presetIconBox}>
            <MaterialCommunityIcons name={icon} size={22} color={COLORS.primary} />
         </View>
         <View style={styles.presetContent}>
            <Text style={styles.presetName}>{name}</Text>
            <Text style={styles.presetTime}>{time}</Text>
         </View>
         <Switch 
            value={value}
            onValueChange={onToggle}
            trackColor={{ false: COLORS.slate[200], true: COLORS.success }}
            thumbColor="#fff"
         />
      </View>
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
    gap: SPACING.s,
  },
  mainTitle: {
    ...TYPOGRAPHY.hero,
    color: '#FFF',
    fontSize: ms(30),
  },
  subTitle: {
    ...TYPOGRAPHY.body,
    color: 'rgba(255,255,255,0.7)',
    maxWidth: '85%',
  },
  mainContent: {
    paddingHorizontal: SPACING.l,
    marginTop: SPACING.l,
  },
  section: {
    marginBottom: SPACING.l,
  },
  sectionHeader: {
    marginBottom: SPACING.s,
  },
  sectionTitle: {
    ...TYPOGRAPHY.tag,
    color: COLORS.slate[500],
  },
  whiteCard: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.slate[100],
  },
  timeSelectionRow: {
    flexDirection: 'row',
    gap: SPACING.m,
  },
  timeInput: {
    flex: 1,
    gap: SPACING.xs,
  },
  timeLabel: {
    ...TYPOGRAPHY.tag,
    fontSize: 9,
    color: COLORS.slate[400],
  },
  timeSelector: {
    height: vs(50),
    backgroundColor: COLORS.slate[50],
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.slate[100],
  },
  timeValue: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.black,
  },
  whiteCardList: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.slate[100],
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.m,
  },
  presetIconBox: {
    width: ms(44),
    height: ms(44),
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.slate[50],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.slate[100],
  },
  presetContent: {
    flex: 1,
    marginLeft: SPACING.m,
  },
  presetName: {
    ...TYPOGRAPHY.bodyLarge,
  },
  presetTime: {
    ...TYPOGRAPHY.body,
    color: COLORS.slate[400],
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.slate[100],
    marginHorizontal: SPACING.m,
  },
  earningsCard: {
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
      ...SHADOWS.medium,
  },
  projGradient: {
     padding: SPACING.m,
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
  },
  projLeft: {
     gap: 4,
  },
  projTag: {
     ...TYPOGRAPHY.tag,
     color: '#A7F3D0',
  },
  projAmount: {
     ...TYPOGRAPHY.h2,
     color: '#FFF',
  },
  projSub: {
     ...TYPOGRAPHY.body,
     color: 'rgba(255,255,255,0.7)',
  },
  projBadge: {
     flexDirection: 'row',
     alignItems: 'center',
     gap: 6,
     backgroundColor: 'rgba(255,255,255,0.15)',
     paddingHorizontal: 10,
     paddingVertical: 6,
     borderRadius: RADIUS.md,
     borderWidth: 1,
     borderColor: 'rgba(255,255,255,0.2)',
  },
  projBadgeText: {
     color: '#FFF',
     ...TYPOGRAPHY.tag,
     fontSize: 9,
  },
  saveBtn: {
     backgroundColor: COLORS.black,
     height: vs(55),
     borderRadius: RADIUS.full,
     justifyContent: 'center',
     alignItems: 'center',
     marginTop: SPACING.l,
     ...SHADOWS.medium,
  },
  saveBtnText: {
     color: '#FFF',
     ...TYPOGRAPHY.bodyLarge,
     letterSpacing: 1,
  },
  versionTag: {
    textAlign: 'center',
    ...TYPOGRAPHY.tag,
    color: COLORS.slate[400],
    marginTop: SPACING.l,
  },
  decorImg: {
    width: '100%',
    height: '100%',
  },
  activeScheduleCard: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.slate[100],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.m,
  },
  activeShiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.slate[50],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.slate[100],
  },
  activeShiftIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeShiftInfo: {
    gap: 2,
  },
  activeShiftName: {
    ...TYPOGRAPHY.tag,
    fontSize: 10,
    color: COLORS.slate[700],
  },
  activeShiftTime: {
    ...TYPOGRAPHY.body,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  activeSeparator: {
    // Hidden in flex wrap
  },
});
