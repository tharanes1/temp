import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MapView, Circle, Marker, PROVIDER_GOOGLE } from '@/shared/components/map/MapView';
import { SafeAreaView } from "react-native-safe-area-context";

// Providers & Hooks
import { useLocation } from "@/features/map/hooks/useLocation";
import { useSettings } from "@/core/providers/SettingsContext";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

// Feature Components & Constants
import { darkMapStyle } from "../constants/mapStyles";
import { ZoneCard } from "../components/ZoneCard";

const PRIMARY_BLUE = "#1800ad";

// TODO: wire up to real zone data from backend once the zones endpoint is live.
const primaryZone: { name: string; demandLevel: 'low' | 'medium' | 'high' | 'very_high'; activeRiders: number; activeOrders: number } | null = null;

export default function OperatingZonesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { location } = useLocation();
  const { darkMode } = useSettings();

  // Theme support
  const bgColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const subtextColor = useThemeColor({}, "subtext");
  const cardColor = useThemeColor({}, "card");
  const borderColor = useThemeColor({}, "border");

  const handleRequestChange = () => {
    Alert.alert(t("zones.request_change"), t("zones.footer_note"), [
      {
        text: t("common.confirm"),
        onPress: () => console.log("Change requested"),
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 🔴 PREMIUM MAP HEADER */}
      <View style={styles.mapHeader}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: location?.latitude || 12.9716,
            longitude: location?.longitude || 77.5946,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          customMapStyle={darkMode ? darkMapStyle : []}
        >
          <Marker
            coordinate={{
              latitude: location?.latitude || 12.9716,
              longitude: location?.longitude || 77.5946,
            }}
            title={t("ops_mock.city_center")}
          >
            <View style={styles.markerContainer}>
              <View style={styles.markerInner} />
            </View>
          </Marker>
          <Circle
            center={{
              latitude: location?.latitude || 12.9716,
              longitude: location?.longitude || 77.5946,
            }}
            radius={3000}
            fillColor={
              darkMode ? "rgba(24, 0, 173, 0.1)" : "rgba(24, 0, 173, 0.05)"
            }
            strokeColor={PRIMARY_BLUE}
            strokeWidth={1}
          />
        </MapView>

        <SafeAreaView edges={["top"]} style={styles.headerOverlay}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={PRIMARY_BLUE} />
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ZoneCard
          cardColor={cardColor}
          borderColor={borderColor}
          textColor={textColor}
          subtextColor={subtextColor}
          darkMode={darkMode}
          onRequestChange={handleRequestChange}
          {...(primaryZone
            ? {
                zone: {
                  name: primaryZone.name,
                  demandLevel: primaryZone.demandLevel,
                  activeRiders: primaryZone.activeRiders,
                  activeOrders: primaryZone.activeOrders,
                },
              }
            : {})}
        />

        <View style={styles.noteBox}>
          <Ionicons name="time-outline" size={16} color={subtextColor} />
          <Text style={[styles.noteText, { color: subtextColor }]}>
            {t("zones.footer_note")}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapHeader: {
    height: 350,
    width: "100%",
    overflow: "hidden",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(24, 0, 173, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  markerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: PRIMARY_BLUE,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.8)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  noteBox: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 25,
    paddingHorizontal: 20,
  },
  noteText: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
  },
});
