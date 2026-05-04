import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { COLORS } from "@/shared/theme";

const PRIMARY_BLUE = "#1800ad";

interface ZoneCardProps {
  cardColor: string;
  borderColor: string;
  textColor: string;
  subtextColor: string;
  darkMode: boolean;
  onRequestChange: () => void;
  /**
   * Server-driven zone payload from /api/v1/location/operating-zones.  When
   * absent, the component falls back to its translated default labels (the
   * first-launch / cold-start case).
   */
  zone?: {
    name: string;
    demandLevel: 'low' | 'medium' | 'high' | 'very_high';
    activeRiders: number;
    activeOrders: number;
  };
}

const DEMAND_BADGE: Record<'low' | 'medium' | 'high' | 'very_high', { label: string; color: string }> = {
  low: { label: 'LOW', color: '#94A3B8' },
  medium: { label: 'MEDIUM', color: '#F59E0B' },
  high: { label: 'HIGH', color: '#16A34A' },
  very_high: { label: 'VERY HIGH', color: '#EF4444' },
};

export const ZoneCard = ({
  cardColor,
  borderColor,
  textColor,
  subtextColor,
  darkMode,
  onRequestChange,
  zone,
}: ZoneCardProps) => {
  const { t } = useTranslation();
  const demandStyle = zone ? DEMAND_BADGE[zone.demandLevel] : { label: t('zones.status_active'), color: '#16A34A' };

  return (
    <View
      style={[
        styles.zoneCard,
        { backgroundColor: cardColor, borderColor: borderColor },
      ]}
    >
      <View style={styles.zoneHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.zoneLabel, { color: subtextColor }]}>
            {t("zones.primary_zone")}
          </Text>
          <View style={styles.nameRow}>
            <Text style={[styles.zoneName, { color: textColor }]}>
              {zone?.name ?? t("ops_mock.city_center")}
            </Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: darkMode
                    ? `${demandStyle.color}33`
                    : `${demandStyle.color}22`,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: demandStyle.color },
                ]}
              >
                ● {demandStyle.label}
              </Text>
            </View>
          </View>
          {zone ? (
            <Text style={[styles.zoneLabel, { color: subtextColor, marginTop: 6, letterSpacing: 0.5 }]}>
              {zone.activeRiders} riders · {zone.activeOrders} active orders
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.rulesSection}>
        <Text style={[styles.rulesTitle, { color: textColor }]}>
          {t("zones.rules_title")}
        </Text>
        <RuleItem text={t("zones.rule_1")} color={subtextColor} />
        <RuleItem text={t("zones.rule_2")} color={subtextColor} />
      </View>

      <TouchableOpacity
        style={styles.changeBtn}
        onPress={onRequestChange}
      >
        <Text style={styles.changeBtnText}>
          {t("zones.request_change")}
        </Text>
        <Ionicons name="swap-horizontal" size={18} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};

function RuleItem({ text, color }: { text: string; color: string }) {
  return (
    <View style={styles.ruleRow}>
      <View style={styles.ruleBullet} />
      <Text style={[styles.ruleText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  zoneCard: {
    borderRadius: 30,
    padding: 25,
    marginTop: -40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
  },
  zoneHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  zoneLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  zoneName: {
    fontSize: 22,
    fontWeight: "900",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "900",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginVertical: 25,
  },
  rulesSection: {
    marginBottom: 30,
  },
  rulesTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 15,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  ruleBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY_BLUE,
  },
  ruleText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
  },
  changeBtn: {
    height: 65,
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    shadowColor: PRIMARY_BLUE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  changeBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
