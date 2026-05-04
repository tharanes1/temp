import React, { forwardRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@/shared/theme';
import { ms } from '@/shared/utils/responsive';

type ProCardProps = {
  onLayout?: (event: any) => void;
};

export const ProCard = forwardRef<View, ProCardProps>((props, ref) => {
  const { onLayout } = props;
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View 
      style={[styles.proCard, { ...SHADOWS.medium }]} 
      ref={ref}
      onLayout={onLayout}
    >
      <View style={styles.proHeader}>
        <View style={styles.proLogoContainer}>
          <Text style={styles.proLogoText}>cravix</Text>
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>{t("profile.active")}</Text>
          </View>
        </View>
        <Ionicons
          name="chevron-down"
          size={20}
          color={COLORS.slate[400]}
        />
      </View>
      <Text style={styles.proSavingsText}>
        ₹1,257 {t("profile.earned_7_days")}
      </Text>
      <TouchableOpacity
        onPress={() => router.push("/incentives")}
        activeOpacity={0.7}
      >
        <Text style={styles.proExploreText}>
          {t("profile.explore_pro")}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

ProCard.displayName = 'ProCard';

const styles = StyleSheet.create({
  proCard: {
    backgroundColor: "#FFF",
    borderRadius: RADIUS.lg,
    padding: SPACING.l,
    marginBottom: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.slate[50],
  },
  proHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  proLogoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  proLogoText: {
    ...TYPOGRAPHY.hero,
    fontSize: ms(22),
    letterSpacing: -1,
  },
  proBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proBadgeText: {
    ...TYPOGRAPHY.tag,
    color: COLORS.success,
  },
  proSavingsText: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: "800",
    marginBottom: 4,
  },
  proExploreText: {
    ...TYPOGRAPHY.body,
    color: COLORS.slate[500],
    fontWeight: "600",
  },
});
