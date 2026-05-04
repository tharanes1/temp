import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming,
  Easing
} from 'react-native-reanimated';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { useTranslation } from 'react-i18next';
import { useLocation } from '@/features/map/hooks/useLocation';
import { useActiveOrder } from '@/features/orders/hooks/useActiveOrder';
import { MapView, Marker, Polyline, PROVIDER_GOOGLE } from '@/shared/components/map/MapView';
import { ms, s, vs, SCREEN_WIDTH, SCREEN_HEIGHT } from '@/shared/utils/responsive';

// Premium Dark Map Style (Mapbox-inspired)
const mapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#0f172a" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#94a3b8" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1e293b" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#cbd5e1" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#cbd5e1" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#064e3b" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#10b981" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1e293b" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#334155" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#94a3b8" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#334155" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1e293b" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#facc15" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#1e1b4b" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#4f46e5" }] }
];

export default function ActiveNavigation() {
  const router = useRouter();
  const { t } = useTranslation();
  const [distance, setDistance] = useState(1.2);
  const [time, setTime] = useState(6);
  
  const { location } = useLocation();

  // Theme support
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const cardAltColor = useThemeColor({}, 'cardSecondary');
  
  const { darkMode } = useSettings();
  const isDark = darkMode;

  // Animation for the rider pulse
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.8, { duration: 1500, easing: Easing.out(Easing.quad) }),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.15 + (1.8 - pulse.value) * 0.5,
  }));

  const { order: activeOrder, setStatus } = useActiveOrder();

  // Real coords from /orders/active — replaces the offset-from-location fakes.
  const hubCoords = activeOrder?.hubCoords ?? null;
  const destCoords = activeOrder?.destCoords ?? null;

  const handleComplete = async () => {
    if (!activeOrder) {
      router.replace('/orders');
      return;
    }
    try {
      // Walk through the next valid transition.
      switch (activeOrder.status) {
        case 'accepted':
          await setStatus('picked_up');
          break;
        case 'picked_up':
          await setStatus('en_route');
          break;
        case 'en_route':
          await setStatus('arrived');
          break;
        case 'arrived':
          // Delivery proof + final transition belongs in a dedicated capture
          // screen — for now route there.  Until that screen ships, the
          // backend will reject DELIVERED without `proofImageUrl` so we leave
          // the rider on the arrived state.
          router.replace('/orders');
          return;
        default:
          break;
      }
    } catch (e) {
      if (__DEV__) console.warn('Status transition failed:', (e as Error).message);
    }
    router.replace('/orders');
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* REAL-TIME MAP (Mapbox Style) */}
      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          customMapStyle={isDark ? mapStyle : []}
          initialRegion={{
            latitude: location?.latitude || 12.9716,
            longitude: location?.longitude || 77.5946,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          region={location ? {
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          } : undefined}
        >
          {location && (
            <Marker
              coordinate={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.markerWrapper}>
                <Animated.View style={[styles.pulseCircle, pulseStyle]} />
                <View style={styles.solidMarker}>
                  <MaterialCommunityIcons name="motorbike" size={20} color="#fff" />
                </View>
              </View>
            </Marker>
          )}

          {/* ROUTE POLYLINE — server-provided hub + destination */}
          {location && hubCoords && destCoords && (
            <Polyline
              coordinates={[
                { latitude: location.latitude, longitude: location.longitude },
                { latitude: hubCoords.latitude, longitude: hubCoords.longitude },
                { latitude: destCoords.latitude, longitude: destCoords.longitude },
              ]}
              strokeColor={isDark ? "#818cf8" : "#1800ad"}
              strokeWidth={4}
              lineDashPattern={[0]}
            />
          )}

          {/* PICKUP — hub coords from /orders/active */}
          {hubCoords && (
            <Marker coordinate={hubCoords}>
              <View style={styles.destPin}>
                <View style={styles.destLabel}>
                  <Text style={styles.destLabelText}>PICKUP</Text>
                </View>
                <Ionicons name="location" size={40} color="#EF4444" />
              </View>
            </Marker>
          )}

          {/* DROP — destination coords from /orders/active */}
          {destCoords && (
            <Marker coordinate={destCoords}>
              <View style={styles.destPin}>
                <View style={[styles.destLabel, { backgroundColor: '#10B981' }]}>
                  <Text style={styles.destLabelText}>DROP</Text>
                </View>
                <Ionicons name="location" size={40} color="#10B981" />
              </View>
            </Marker>
          )}
        </MapView>
        
        <LinearGradient
          colors={[
            isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255,255,255,0.3)', 
            'transparent', 
            isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255,255,255,0.4)'
          ]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      {/* TOP NAVIGATION CARD */}
      <SafeAreaView edges={['top']} style={styles.topOverlay}>
        <View style={styles.navCard}>
          <View style={styles.navIconBox}>
             <MaterialCommunityIcons name="arrow-right-top-bold" size={32} color="#fff" />
          </View>
          <View style={styles.navTextContainer}>
            <Text style={styles.turnDist}>450m</Text>
            <Text style={styles.turnTitle}>{t('nav_live.turn_instruction')}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* BOTTOM ACTION SHEET */}
      <View style={[styles.bottomSheet, { backgroundColor: cardColor, borderColor: borderColor, borderTopWidth: isDark ? 1 : 0 }]}>
        <View style={[styles.sheetHandle, { backgroundColor: borderColor }]} />
        <View style={styles.missionDetails}>
          <View style={styles.infoGroup}>
            <Text style={[styles.infoLabel, { color: subtextColor }]}>{t('nav_live.time_left')}</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{t('nav_live.min', { count: time })}</Text>
          </View>
          <View style={[styles.dividerVertical, { backgroundColor: borderColor }]} />
          <View style={styles.infoGroup}>
            <Text style={[styles.infoLabel, { color: subtextColor }]}>{t('nav_live.distance')}</Text>
            <Text style={[styles.infoValue, { color: textColor }]}>{t('nav_live.km', { count: distance })}</Text>
          </View>
        </View>

        <View style={[styles.addressBox, { backgroundColor: cardAltColor, borderColor: borderColor }]}>
          <View style={[styles.addressIcon, { backgroundColor: isDark ? '#1e1b4b' : '#EEF2FF' }]}>
            <Ionicons name="pin" size={20} color={isDark ? "#818cf8" : "#1800ad"} />
          </View>
          <View style={styles.addressTextContent}>
             <Text style={[styles.addressTitle, { color: textColor }]}>Market St</Text>
             <Text style={[styles.addressSub, { color: subtextColor }]}>{t('ops_mock.delivery_addr')}</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.completeBtn}
          onPress={handleComplete}
        >
          <Text style={styles.completeBtnText}>{t('nav_live.arrived')}</Text>
        </TouchableOpacity>
      </View>
          </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerWrapper: {
    width: ms(60),
    height: ms(60),
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseCircle: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: '#1800ad',
    position: 'absolute',
  },
  solidMarker: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    backgroundColor: '#1800ad',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  destPin: {
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  destLabel: {
    backgroundColor: '#EF4444',
    paddingHorizontal: ms(10),
    paddingVertical: ms(4),
    borderRadius: ms(8),
    marginBottom: -ms(5),
    zIndex: 10,
  },
  destLabelText: {
    color: '#FFF',
    fontSize: ms(10),
    fontWeight: '900',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: ms(20),
    paddingTop: vs(10),
  },
  navCard: {
    backgroundColor: '#22C55E',
    borderRadius: ms(20),
    padding: ms(20),
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  navIconBox: {
    width: ms(50),
    height: ms(50),
    borderRadius: ms(12),
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(20),
  },
  navTextContainer: {
    flex: 1,
  },
  turnDist: {
    fontSize: ms(24),
    fontWeight: '900',
    color: '#fff',
  },
  turnTitle: {
    fontSize: ms(14),
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: ms(35),
    borderTopRightRadius: ms(35),
    padding: ms(25),
    paddingTop: vs(15),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetHandle: {
    width: ms(40),
    height: ms(5),
    borderRadius: ms(5),
    alignSelf: 'center',
    marginBottom: vs(25),
  },
  missionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: vs(30),
  },
  infoGroup: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: ms(11),
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: vs(5),
  },
  infoValue: {
    fontSize: ms(20),
    fontWeight: '900',
  },
  dividerVertical: {
    width: 1,
    height: '100%',
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ms(18),
    borderRadius: ms(20),
    borderWidth: 1,
    marginBottom: vs(25),
  },
  addressIcon: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(15),
  },
  addressTextContent: {
    flex: 1,
  },
  addressTitle: {
    fontSize: ms(16),
    fontWeight: '800',
  },
  addressSub: {
    fontSize: ms(12),
    marginTop: 2,
  },
  completeBtn: {
    width: '100%',
    height: vs(65),
    backgroundColor: '#1800ad',
    borderRadius: ms(20),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1800ad',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  completeBtnText: {
    color: '#fff',
    fontSize: ms(15),
    fontWeight: '900',
    letterSpacing: 1,
  },
});
