import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@/shared/theme';
import { vs } from '@/shared/utils/responsive';
import { WeeklyData } from '../hooks/useEarningsData';

interface RevenueChartProps {
  onMeasureChart: (event: any) => void;
  chartRef: React.RefObject<View | null>;
  chartData: WeeklyData[];
}

export const RevenueChart = ({ 
  onMeasureChart, 
  chartRef, 
  chartData 
}: RevenueChartProps) => {
  const { t } = useTranslation();

  return (
    <View 
      style={styles.section} 
      ref={chartRef}
      onLayout={onMeasureChart}
    >
      <View style={[styles.whiteCard, { ...SHADOWS.soft }]}>
        <View style={styles.cardSectionHeader}>
          <Text style={styles.cardTitleText}>{t('earnings.weekly_revenue')}</Text>
          <TouchableOpacity style={styles.filterBtn}>
            <Text style={styles.filterText}>{t('earnings.last_7_days')}</Text>
            <Ionicons name="chevron-down" size={12} color={COLORS.slate[400]} />
          </TouchableOpacity>
        </View>
        <View style={styles.chartBox}>
          {chartData.map((item, idx) => (
            <View key={idx} style={styles.chartCol}>
              <View style={styles.chartTrack}>
                <LinearGradient 
                  colors={item.active ? [COLORS.primary, '#2563EB'] : [COLORS.slate[100], COLORS.slate[200]]}
                  style={[styles.chartBar, { height: `${item.value}%` }]} 
                />
              </View>
              <Text style={[styles.chartDay, item.active && { color: COLORS.primary, fontWeight: '900' }]}>{t('earnings.' + item.day)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: SPACING.l,
  },
  whiteCard: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.slate[50],
  },
  cardSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.l,
  },
  cardTitleText: {
    ...TYPOGRAPHY.tag,
    color: COLORS.slate[400],
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.slate[50],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  filterText: {
    ...TYPOGRAPHY.tag,
    color: COLORS.slate[500],
  },
  chartBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: vs(160),
    paddingHorizontal: 5,
  },
  chartCol: {
    alignItems: 'center',
    width: '12%',
  },
  chartTrack: {
    flex: 1,
    width: 10,
    backgroundColor: COLORS.slate[100],
    borderRadius: 5,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    borderRadius: 5,
  },
  chartDay: {
    ...TYPOGRAPHY.tag,
    fontSize: 9,
    color: COLORS.slate[400],
    marginTop: 10,
  },
});
