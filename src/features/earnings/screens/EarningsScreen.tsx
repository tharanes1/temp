import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';

// Theme & Utils
import { COLORS, SPACING } from '@/shared/theme';

// Feedback
import { useTourStore } from '@/shared/store/tourStore';

// Earnings Feature Components & Hooks
import { useEarningsData } from '../hooks/useEarningsData';
import { EarningsHeader } from '../components/EarningsHeader';
import { EarningsGoalCard } from '../components/EarningsGoalCard';
import { StatsGrid } from '../components/StatsGrid';
import { RevenueChart } from '../components/RevenueChart';
import { TransactionsList } from '../components/TransactionsList';

import { useSpotlightTour } from '@/shared/hooks/useSpotlightTour';

export default function EarningsScreen() {
  const params = useLocalSearchParams();
  const tabBarHeight = useBottomTabBarHeight();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);

  const { t } = useTranslation();
  const {
    orderStats,
    secondsOnline,
    chartData,
    activities,
    formatTime,
  } = useEarningsData();

  // Precision Refs for Absolute Measurement (App Tour)
  const refs = {
    wallet: useRef<View>(null),
    target: useRef<View>(null),
    metrics: useRef<View>(null),
    chart: useRef<View>(null),
    history: useRef<View>(null),
  };

  const keys = ['wallet', 'target', 'metrics', 'chart', 'history'];

  const { measureAndStart } = useTourStore();

  const { onScrollBeginDrag, onMomentumScrollEnd, onLayoutTarget } = useSpotlightTour({ refs, scrollRef, keys });

  const [tourVisible, setTourVisible] = useState(params.showTour === 'true');

  useEffect(() => {
    if (!tourVisible) return;
    setTourVisible(false);
    measureAndStart([
      { title: "Wallet Balance", desc: "View your total withdrawable earnings and pending settlements here.", icon: "wallet-outline", iconType: "Ionicons", ref: refs.wallet },
      { title: "Daily Target", desc: "Track your progress towards your daily earning goals and bonuses.", icon: "trending-up", iconType: "Ionicons", ref: refs.target },
      { title: "Efficiency Metrics", desc: "Analyze your active time, mission counts, and acceptance rates.", icon: "speedometer-outline", iconType: "Ionicons", ref: refs.metrics },
      { title: "Revenue Analytics", desc: "Visualize your earnings trends over the past week with this dynamic chart.", icon: "bar-chart-outline", iconType: "Ionicons", ref: refs.chart },
      { title: "Recent Activity", desc: "Review your detailed transaction history and settlement statuses.", icon: "list", iconType: "Ionicons", ref: refs.history },
    ]);
  }, [tourVisible]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar style="light" />
      
      <ScrollView 
        ref={scrollRef}
        showsVerticalScrollIndicator={false} 
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 30 }]}
        bounces={true}
      >
        <EarningsHeader 
          walletRef={refs.wallet}
          onMeasureWallet={onLayoutTarget('wallet')}
        />

        <View style={styles.mainContent}>
          <EarningsGoalCard 
            targetRef={refs.target}
            onMeasureTarget={onLayoutTarget('target')}
          />

          <StatsGrid 
            secondsOnline={secondsOnline}
            orderStats={orderStats}
            metricsRef={refs.metrics}
            onMeasureMetrics={onLayoutTarget('metrics')}
            formatTime={formatTime}
          />

          <RevenueChart 
            chartData={chartData}
            chartRef={refs.chart}
            onMeasureChart={onLayoutTarget('chart')}
          />

          <TransactionsList 
            activities={activities}
            historyRef={refs.history}
            onMeasureHistory={onLayoutTarget('history')}
          />

          <Text style={styles.versionTag}>{t('earnings.version_info', { version: '4.2.0' })}</Text>
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
  mainContent: {
    paddingHorizontal: SPACING.l,
    marginTop: -35,
  },
  versionTag: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slate[400],
    marginTop: SPACING.l,
  },
});
