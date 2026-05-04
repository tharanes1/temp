import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { vs } from "@/shared/utils/responsive";
import { BottomDecor } from "@/shared/components/layout/BottomDecor";
import { useTourStore } from "@/shared/store/tourStore";
import { useSpotlightTour } from "@/shared/hooks/useSpotlightTour";
import { Feather } from "@expo/vector-icons";

// Home Feature Components & Hooks
import { useHomeData } from "../hooks/useHomeData";
import { HomeHeader } from "../components/HomeHeader";
import { DutyToggleCard } from "../components/DutyToggleCard";
import { PerformanceStats } from "../components/PerformanceStats";
import { GoalTracker } from "../components/GoalTracker";
import { WeeklyInsights } from "../components/WeeklyInsights";

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = "#1800ad";

export default function Home() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);

  // Precision Refs
  const refs = {
    header: useRef<View>(null),
    status: useRef<View>(null),
    metrics: useRef<View>(null),
    heatmap: useRef<View>(null),
    goal: useRef<View>(null),
    insights: useRef<View>(null),
  };

  const keys = ['header', 'status', 'metrics', 'heatmap', 'goal', 'insights'];

  // Custom Hooks
  const { 
    isOnline, 
    riderName, 
    profileImage, 
    tourVisible, 
    setTourVisible, 
    getGreeting, 
    toggleDuty 
  } = useHomeData();

  const { measureAndStart } = useTourStore();

  const { onScrollBeginDrag, onMomentumScrollEnd, onLayoutTarget } = useSpotlightTour({ refs, scrollRef, keys });

  // Start tour: measure refs directly, no dependency on absoluteLayouts
  React.useEffect(() => {
    if (!tourVisible) return;
    setTourVisible(false);
    measureAndStart([
      { title: "Quick Actions", desc: "Access your profile, notifications, and app instructions quickly from here.", icon: "flash", iconType: "Ionicons", ref: refs.header },
      { title: "Status Toggle", desc: "Switch this on to go online and start receiving high-priority order pings.", icon: "power", iconType: "Ionicons", ref: refs.status },
      { title: "Performance Metrics", desc: "Track your real-time earnings and mission counts for the current day.", icon: "bar-chart", iconType: "Ionicons", ref: refs.metrics },
      { title: "Operational Heatmap", desc: "View live demand hotspots in your city to find areas with higher payouts.", icon: "map", iconType: "Ionicons", ref: refs.heatmap },
      { title: "Daily Goal", desc: "Stay motivated by tracking your daily goal and unlocking bonus rewards.", icon: "trending-up", iconType: "Ionicons", ref: refs.goal },
      { title: "Weekly Insights", desc: "Analyze your performance trends over the last 7 days to optimize your shifts.", icon: "analytics", iconType: "Ionicons", ref: refs.insights },
    ]);
  }, [tourVisible]);

  return (
    <View style={styles.container}>
      <BottomDecor style={{ bottom: -20, right: -40 }} />
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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + 30 },
        ]}
      >
        {/* ELEGANT HERO HEADER - NOW INSIDE SCROLLVIEW */}
        <View style={styles.heroBg}>
          <LinearGradient
            colors={["#1800ad", "#2563EB"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.blob1} />
          <View style={styles.blob2} />
          <View style={styles.elegantPattern}>
            <Image
              source={require("@/assets/images/rider_illustration.png")}
              style={styles.patternImg}
              resizeMode="cover"
            />
          </View>
        </View>

        <SafeAreaView edges={["top"]} style={styles.safeHeader}>
          
          <View ref={refs.header}>
            <HomeHeader 
              greeting={getGreeting()}
              riderName={riderName}
              profileImage={profileImage}
              onLayout={onLayoutTarget('header')}
            />
          </View>

          <View style={styles.mainOverlap}>
            
            <DutyToggleCard 
              ref={refs.status}
              isOnline={isOnline}
              onToggle={toggleDuty}
              onLayout={onLayoutTarget('status')}
            />

            <PerformanceStats 
              ref={refs.metrics}
              onLayout={onLayoutTarget('metrics')}
            />

            {/* HEATMAP ACCESS */}
            <View
              ref={refs.heatmap}
              onLayout={onLayoutTarget('heatmap')}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push("/heatmap")}
              >
                <LinearGradient
                  colors={["#EEF2FF", "#E0E7FF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.heatmapBanner}
                >
                  <View style={[styles.hmIconWrap, { backgroundColor: "#FFF" }]}>
                    <Feather name="map" size={20} color={PRIMARY_BLUE} />
                  </View>
                  <View style={styles.hmTextWrap}>
                    <Text style={[styles.hmTitle, { color: "#1E293B" }]}>Operational Heatmap</Text>
                    <Text style={[styles.hmSub, { color: "#64748B" }]}>
                      Identify high-demand zones instantly
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={PRIMARY_BLUE} />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <GoalTracker 
              ref={refs.goal}
              onLayout={onLayoutTarget('goal')}
            />

            <WeeklyInsights 
              ref={refs.insights}
              onLayout={onLayoutTarget('insights')}
            />

          </View>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7FA" },
  heroBg: {
    height: vs(260),
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: "hidden",
  },
  blob1: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  blob2: {
    position: "absolute",
    bottom: -20,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  elegantPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.05,
  },
  patternImg: { width: "100%", height: "100%" },

  scrollContent: { paddingTop: 0 },
  safeHeader: { flex: 1, paddingHorizontal: 20, marginTop: -vs(260) },

  mainOverlap: { marginTop: -vs(20) },

  heatmapBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: "#94A3B8",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  hmIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  hmTextWrap: { flex: 1 },
  hmTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B", marginBottom: 4 },
  hmSub: { fontSize: 12, color: "#64748B", fontWeight: "400" },
});
