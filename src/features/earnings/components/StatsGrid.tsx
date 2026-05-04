import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@/shared/theme';
import { ms, SCREEN_WIDTH } from '@/shared/utils/responsive';

interface StatsGridProps {
  onMeasureMetrics: (event: any) => void;
  metricsRef: React.RefObject<View | null>;
  secondsOnline: number;
  orderStats: { accepted: number; received: number };
  formatTime: (s: number) => string;
}

export const StatsGrid = ({ 
  onMeasureMetrics, 
  metricsRef, 
  secondsOnline, 
  orderStats, 
  formatTime 
}: StatsGridProps) => {
  const { t } = useTranslation();

  return (
    <View 
      style={styles.section} 
      ref={metricsRef}
      onLayout={onMeasureMetrics}
    >
      <View style={styles.metricsGrid}>
        <MetricBox 
          icon="timer-outline" 
          value={formatTime(secondsOnline)} 
          label={t('earnings.time_active')} 
          color={COLORS.success} 
          bg="#F0FDF4" 
        />
        <MetricBox 
          icon="bicycle" 
          value="12" 
          label={t('earnings.mission_count')} 
          color={COLORS.primary} 
          bg="#EFF6FF" 
        />
        <MetricBox 
          icon="analytics" 
          value={`${orderStats.received > 0 ? Math.round((orderStats.accepted / orderStats.received) * 100) : 100}%`} 
          label={t('earnings.acceptance')} 
          color="#EA580C" 
          bg="#FFF7ED" 
        />
        <MetricBox 
          icon="flash-outline" 
          value="1.2x" 
          label={t('earnings.active_bonus')} 
          color="#CA8A04" 
          bg="#FEFCE8" 
        />
      </View>
    </View>
  );
};

function MetricBox({ icon, value, label, color, bg }: any) {
  return (
    <View style={[styles.metricCard, { ...SHADOWS.soft }]}>
      <View style={[styles.metricIconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: SPACING.l,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.m,
  },
  metricCard: {
    width: (SCREEN_WIDTH - SPACING.l * 2 - SPACING.m) / 2,
    backgroundColor: '#FFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.slate[50],
  },
  metricIconBox: {
    width: ms(40),
    height: ms(40),
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricValue: {
    ...TYPOGRAPHY.h3,
  },
  metricLabel: {
    ...TYPOGRAPHY.tag,
    color: COLORS.slate[400],
    marginTop: 4,
  },
});
