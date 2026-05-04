import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { vs } from "@/shared/utils/responsive";

interface WeeklyInsightsProps {
  onLayout: (event: any) => void;
}

export const WeeklyInsights = React.forwardRef<View, WeeklyInsightsProps>(({ 
  onLayout 
}, ref) => {
  return (
    <View 
      style={styles.elegantCard} 
      ref={ref}
      onLayout={onLayout}
    >
      <View style={styles.metricHeaderRow}>
        <Text style={styles.sectionTitle}>Weekly Insights</Text>
        <Feather name="bar-chart-2" size={18} color="#64748B" />
      </View>

      <View style={styles.chartArea}>
        {[40, 70, 45, 90, 65, 80, 50].map((val, i) => (
          <View key={i} style={styles.chartCol}>
            <View style={styles.chartTrack}>
              <LinearGradient
                colors={["#1800ad", "#3B82F6"]}
                style={[styles.chartFill, { height: `${val}%` }]}
              />
            </View>
            <Text style={styles.chartLabel}>
              {["M", "T", "W", "T", "F", "S", "S"][i]}
            </Text>
          </View>
        ))}
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
  metricHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  chartArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: vs(140),
    marginTop: 10,
    paddingHorizontal: 5,
  },
  chartCol: { alignItems: "center", width: 24, height: "100%" },
  chartTrack: {
    flex: 1,
    width: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  chartFill: { width: "100%", borderRadius: 4 },
  chartLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    marginTop: 10,
  },
});
