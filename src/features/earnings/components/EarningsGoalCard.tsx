import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@/shared/theme';
import { ms } from '@/shared/utils/responsive';

interface EarningsGoalCardProps {
  onMeasureTarget: (event: any) => void;
  targetRef: React.RefObject<View | null>;
}

export const EarningsGoalCard = ({ onMeasureTarget, targetRef }: EarningsGoalCardProps) => {
  const { t } = useTranslation();

  return (
    <View 
      style={styles.section} 
      ref={targetRef}
      onLayout={onMeasureTarget}
    >
      <View style={[styles.whiteCard, { ...SHADOWS.medium }]}>
        <View style={styles.goalTitleRow}>
          <View>
            <Text style={styles.cardTitleText}>{t('earnings.daily_target')}</Text>
            <Text style={styles.goalAmount}>₹1,257 / ₹2,500</Text>
          </View>
          <View style={styles.progressCircle}>
            <Text style={styles.progressPercent}>50%</Text>
          </View>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: '50.3%' }]} />
        </View>
        <Text style={styles.goalInsight}>{t('earnings.goal_insight')}</Text>
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
  goalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  cardTitleText: {
    ...TYPOGRAPHY.tag,
    color: COLORS.slate[400],
  },
  goalAmount: {
    ...TYPOGRAPHY.h2,
    marginTop: 4,
  },
  progressCircle: {
     width: ms(50),
     height: ms(50),
     borderRadius: ms(25),
     backgroundColor: '#EEF2FF',
     justifyContent: 'center',
     alignItems: 'center',
     borderWidth: 3,
     borderColor: COLORS.primary,
  },
  progressPercent: {
     ...TYPOGRAPHY.tag,
     color: COLORS.primary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.slate[100],
    borderRadius: 4,
    marginBottom: SPACING.m,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  goalInsight: {
    ...TYPOGRAPHY.body,
    color: COLORS.slate[500],
    textAlign: 'center',
    fontWeight: '700',
  },
});
