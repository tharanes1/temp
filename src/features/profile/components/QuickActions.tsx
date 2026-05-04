import React, { forwardRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@/shared/theme';
import { vs, ms, SCREEN_WIDTH } from '@/shared/utils/responsive';

type QuickActionsProps = {
  onLayout?: (event: any) => void;
};

export const QuickActions = forwardRef<View, QuickActionsProps>((props, ref) => {
  const { onLayout } = props;
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View 
      style={styles.quickActionsGrid} 
      ref={ref}
      onLayout={onLayout}
    >
      <QuickAction
        icon="location-outline"
        label={t("profile.operating_zones", "Operating\nZones")}
        onPress={() => router.push("/operating-zones")}
      />
      <QuickAction
        icon="wallet-outline"
        label={t("profile.bank_details", "Bank\nDetails")}
        onPress={() => router.push("/add-bank")}
      />
      <QuickAction
        icon="shield-checkmark-outline"
        label={t("profile.incentives", "My\nIncentives")}
        onPress={() => router.push("/incentives")}
      />
    </View>
  );
});

QuickActions.displayName = 'QuickActions';

function QuickAction({ icon, label, onPress }: any) {
  return (
    <TouchableOpacity
      style={[styles.quickActionCard, { ...SHADOWS.soft }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={24} color={COLORS.primary} />
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  quickActionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.l,
  },
  quickActionCard: {
    width: (SCREEN_WIDTH - SPACING.l * 2 - SPACING.m * 2) / 3,
    minHeight: vs(90),
    backgroundColor: "#FFF",
    borderRadius: RADIUS.md,
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.slate[50],
  },
  quickActionLabel: {
    ...TYPOGRAPHY.tag,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 12,
    color: COLORS.slate[700],
  },
});
