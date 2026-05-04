import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface DutyToggleCardProps {
  isOnline: boolean;
  onToggle: (value: boolean) => void;
  onLayout: (event: any) => void;
}

export const DutyToggleCard = React.forwardRef<View, DutyToggleCardProps>(({ 
  isOnline, 
  onToggle, 
  onLayout 
}, ref) => {
  const { t } = useTranslation();

  return (
    <View 
      style={styles.elegantCard} 
      ref={ref}
      onLayout={onLayout}
    >
      <View style={styles.dutyRow}>
        <View style={styles.dutyInfo}>
          <View style={styles.statusLabelRow}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: isOnline ? "#10B981" : "#94A3B8" },
              ]}
            />
            <Text style={styles.dutyStatusText}>
              {isOnline ? t("home.active_on_duty", "Active Duty") : t("home.currently_offline", "Off Duty")}
            </Text>
          </View>
          <Text style={styles.dutySubText}>
            {isOnline ? t("home.active_sub", "System is actively matching you with orders.") : t("home.offline_sub", "Toggle to begin your shift and receive orders.")}
          </Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={onToggle}
          trackColor={{ false: "#E2E8F0", true: "#10B981" }}
          thumbColor="#FFF"
          style={styles.switchCtrl}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  elegantCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 22,
    marginBottom: 20,
    elevation: 6,
    shadowColor: "#94A3B8",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  dutyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dutyInfo: { flex: 1, paddingRight: 20 },
  statusLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  statusIndicator: { width: 8, height: 8, borderRadius: 4 },
  dutyStatusText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: 0.2,
  },
  dutySubText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "400",
    lineHeight: 18,
  },
  switchCtrl: { transform: [{ scale: 1.05 }] },
});
