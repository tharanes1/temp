import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5, Octicons } from "@expo/vector-icons";

interface PerformanceStatsProps {
  onLayout: (event: any) => void;
}

export const PerformanceStats = React.forwardRef<View, PerformanceStatsProps>(({ 
  onLayout 
}, ref) => {
  return (
    <View 
      style={styles.elegantCard} 
      ref={ref}
      onLayout={onLayout}
    >
      <Text style={styles.sectionTitle}>Daily Performance</Text>
      <View style={styles.metricsDivider} />
      <View style={styles.metricsRow}>
        <View style={styles.metricBlock}>
          <View style={styles.metricHeaderRow}>
            <FontAwesome5 name="wallet" size={12} color="#64748B" />
            <Text style={styles.metricLabel}>EARNINGS</Text>
          </View>
          <Text style={styles.metricValue}>₹0.00</Text>
          <Text style={styles.trendUpText}>+12% vs Yesterday</Text>
        </View>

        <View style={styles.verticalDivider} />

        <View style={styles.metricBlock}>
          <View style={styles.metricHeaderRow}>
            <Octicons name="tasklist" size={12} color="#64748B" />
            <Text style={styles.metricLabel}>MISSIONS</Text>
          </View>
          <Text style={styles.metricValue}>0</Text>
          <Text style={styles.trendNeutralText}>0 pending tasks</Text>
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
  metricsRow: { flexDirection: "row", alignItems: "center" },
  metricBlock: { flex: 1 },
  metricHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
  },
  trendUpText: { fontSize: 12, fontWeight: "500", color: "#10B981" },
  trendNeutralText: { fontSize: 12, fontWeight: "500", color: "#64748B" },
  verticalDivider: {
    width: 1,
    height: "80%",
    backgroundColor: "#F1F5F9",
    marginHorizontal: 20,
  },
});
