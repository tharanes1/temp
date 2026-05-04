import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@/shared/theme';
import { ms } from '@/shared/utils/responsive';
import { ActivityItem } from '../hooks/useEarningsData';

interface TransactionsListProps {
  onMeasureHistory: (event: any) => void;
  historyRef: React.RefObject<View | null>;
  activities: ActivityItem[];
}

export const TransactionsList = ({ 
  onMeasureHistory, 
  historyRef, 
  activities 
}: TransactionsListProps) => {
  const { t } = useTranslation();

  return (
    <View 
      style={styles.section} 
      ref={historyRef}
      onLayout={onMeasureHistory}
    >
      <View style={styles.sectionHeadingBox}>
        <Text style={styles.sectionHeadingLabel}>{t('home.recent_transactions')}</Text>
      </View>

      <View style={[styles.whiteCardList, { ...SHADOWS.medium }]}>
        {activities.map((item, idx) => {
          const translatedTitle = item.type === 'order' 
            ? t('home.order_id', { id: item.title.split('#')[1] })
            : t('earnings.bank_settlement');
          
          const translatedSubtitle = item.subtitle.includes('Today')
            ? item.subtitle.replace('Today', t('common.today'))
            : item.subtitle.replace('Yesterday', t('common.yesterday'));

          return (
            <View key={item.id}>
              <View style={styles.activityItem}>
                <View style={[styles.activityIconBox, { backgroundColor: item.type === 'order' ? '#EEF2FF' : '#FFF1F2' }]}>
                  <MaterialCommunityIcons 
                    name={item.type === 'order' ? 'package-variant-closed' : 'bank-transfer-out'} 
                    size={22} 
                    color={item.type === 'order' ? COLORS.primary : COLORS.error} 
                  />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>{translatedTitle}</Text>
                  <Text style={styles.activitySub}>{translatedSubtitle}</Text>
                </View>
                <View style={styles.activityValue}>
                  <Text style={[styles.activityAmt, { color: item.type === 'order' ? COLORS.black : COLORS.error }]}>{item.amount}</Text>
                  <View style={[styles.statusTag, { backgroundColor: item.statusColor + '15' }]}>
                    <Text style={[styles.statusTagTxt, { color: item.statusColor }]}>{t('earnings.' + item.status)}</Text>
                  </View>
                </View>
              </View>
              {idx < activities.length - 1 && <View style={styles.divider} />}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: SPACING.l,
  },
  sectionHeadingBox: {
    marginBottom: SPACING.s,
  },
  sectionHeadingLabel: {
    ...TYPOGRAPHY.tag,
    color: COLORS.slate[400],
  },
  whiteCardList: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.slate[50],
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.m,
  },
  activityIconBox: {
    width: ms(48),
    height: ms(48),
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
    marginLeft: SPACING.m,
  },
  activityTitle: {
    ...TYPOGRAPHY.bodyLarge,
  },
  activitySub: {
    ...TYPOGRAPHY.body,
    color: COLORS.slate[400],
    marginTop: 2,
  },
  activityValue: {
    alignItems: 'flex-end',
    gap: 4,
  },
  activityAmt: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '900',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusTagTxt: {
    ...TYPOGRAPHY.tag,
    fontSize: 8,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.slate[50],
    marginHorizontal: SPACING.m,
  },
});
