import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

interface GoalTrackerProps {
  onLayout: (event: any) => void;
}

export const GoalTracker = React.forwardRef<View, GoalTrackerProps>(({ 
  onLayout 
}, ref) => {
  return (
    <View 
      style={styles.elegantCard} 
      ref={ref}
      onLayout={onLayout}
    >
      <View style={styles.goalHeaderRow}>
        <Text style={styles.sectionTitle}>Daily Earnings Goal</Text>
        <View style={styles.bonusBadge}>
          <Feather name="zap" size={12} color="#D97706" />
          <Text style={styles.bonusBadgeText}>₹200 Bonus</Text>
        </View>
      </View>

      <View style={styles.goalProgressArea}>
        <View style={styles.goalTextRow}>
          <Text style={styles.goalCurrent}>₹850</Text>
          <Text style={styles.goalTarget}>/ ₹1,200</Text>
        </View>

        <View style={styles.progressBarBg}>
          <LinearGradient
            colors={["#1800ad", "#3B82F6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: "70%" }]}
          />
        </View>
        <Text style={styles.goalHint}>
          Earn ₹350 more today to unlock your daily bonus.
        </Text>
      </View>

      <View style={styles.metricsDivider} />

      <View style={styles.activeBonusesList}>
        <View style={styles.bonusItem}>
          <View
            style={[styles.bonusIconBg, { backgroundColor: "#EFF6FF" }]}
          >
            <Feather name="cloud-rain" size={14} color="#3B82F6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bonusTitle}>Rain Bonus Auto-Added</Text>
            <Text style={styles.bonusSub}>
              +₹15 applied to all active deliveries
            </Text>
          </View>
          <Feather name="check-circle" size={16} color="#10B981" />
        </View>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: 0.3,
  },
  metricsDivider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 18 },
  goalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  bonusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bonusBadgeText: { fontSize: 11, fontWeight: "700", color: "#D97706" },
  goalProgressArea: { marginBottom: 10 },
  goalTextRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 8,
  },
  goalCurrent: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  goalTarget: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 4,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: { height: "100%", borderRadius: 4 },
  goalHint: { fontSize: 12, color: "#64748B", fontWeight: "500" },
  activeBonusesList: { marginTop: 5 },
  bonusItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  bonusIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  bonusTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  bonusSub: { fontSize: 11, color: "#64748B", fontWeight: "500" },
});
