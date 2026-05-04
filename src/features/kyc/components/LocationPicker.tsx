import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { MapView, PROVIDER_GOOGLE, Circle } from '@/shared/components/map/MapView';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Fixed relative paths
import { COLORS, SHADOWS, RADIUS, SPACING } from '@/shared/theme';
import { vs, ms } from '@/shared/utils/responsive';
import { Input } from '@/shared/components/ui/Input';

interface AddressData {
  address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

interface LocationPickerProps {
  initialAddress: AddressData;
  onAddressChange: (data: AddressData) => void;
  errorPincode?: string;
}

const PINCODE_PREFIXES: Record<string, string[]> = {
  'Delhi': ['11'], 'Haryana': ['12', '13'], 'Punjab': ['14', '15', '16'], 'Himachal Pradesh': ['17'],
  'Jammu & Kashmir': ['18', '19'], 'Uttar Pradesh': ['20', '21', '22', '23', '24', '25', '26', '27', '28'],
  'Rajasthan': ['30', '31', '32', '33', '34'], 'Gujarat': ['36', '37', '38', '39'],
  'Maharashtra': ['40', '41', '42', '43', '44'], 'Madhya Pradesh': ['45', '46', '47', '48'],
  'Chhattisgarh': ['49'], 'Andhra Pradesh': ['50', '51', '52', '53'], 'Karnataka': ['56', '57', '58', '59'],
  'Tamil Nadu': ['60', '61', '62', '63', '64'], 'Kerala': ['67', '68', '69'], 'West Bengal': ['70', '71', '72', '73', '74'],
  'Odisha': ['75', '76', '77'], 'Assam': ['78'], 'Bihar': ['80', '81', '82', '83', '84', '85']
};

const LocationPicker = memo(({ initialAddress, onAddressChange, errorPincode }: LocationPickerProps) => {
  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState({
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });
  
  const [isLocating, setIsLocating] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AddressData, string>>>({});
  const [successFields, setSuccessFields] = useState<Partial<Record<keyof AddressData, boolean>>>({});
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLocating) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isLocating]);

  const validatePincode = useCallback((pincode: string, state: string) => {
    if (!pincode) return null;
    if (pincode.length !== 6) return "Pincode must be 6 digits";
    if (state && PINCODE_PREFIXES[state]) {
      const match = PINCODE_PREFIXES[state].some(p => pincode.startsWith(p));
      if (!match) return `Invalid pincode for ${state}`;
    }
    return null;
  }, []);

  const handleUpdate = useCallback((key: keyof AddressData, value: string) => {
    const newData = { ...initialAddress, [key]: value };
    onAddressChange(newData);
    setSuccessFields(prev => ({ ...prev, [key]: value.length > 2 }));
    
    if (key === 'pincode' || key === 'state') {
      const err = validatePincode(newData.pincode, newData.state);
      setFieldErrors(prev => ({ ...prev, pincode: err || undefined }));
    }
  }, [initialAddress, onAddressChange, validatePincode]);

  const fetchReverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (result.length > 0) {
        const addr = result[0];
        const mappedData: AddressData = {
          address: `${addr.name || ''} ${addr.street || ''}`.trim(),
          city: addr.city || addr.subregion || '',
          district: addr.district || addr.subregion || '',
          state: addr.region || '',
          pincode: addr.postalCode || '',
        };
        onAddressChange(mappedData);
        
        const successMap: any = {};
        Object.keys(mappedData).forEach(k => successMap[k] = true);
        setSuccessFields(successMap);
        setFieldErrors({});
      }
    } catch (e) {}
  }, [onAddressChange]);

  const syncToCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const newRegion = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      
      setRegion(newRegion);
      setAccuracy(loc.coords.accuracy || 100);
      mapRef.current?.animateToRegion(newRegion, 1000);
      await fetchReverseGeocode(newRegion.latitude, newRegion.longitude);
    } catch (e) {} finally {
      setIsLocating(false);
    }
  };

  const handleManualGeocode = async () => {
    const query = `${initialAddress.address}, ${initialAddress.city}, ${initialAddress.state} ${initialAddress.pincode}`;
    if (query.length < 15) return;
    
    try {
      const result = await Location.geocodeAsync(query);
      if (result.length > 0) {
        const { latitude, longitude } = result[0];
        const newRegion = { latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 1000);
      }
    } catch (e) {}
  };

  const onRegionChangeComplete = useCallback((r: any) => {
    const diff = Math.abs(r.latitude - region.latitude) + Math.abs(r.longitude - region.longitude);
    if (diff > 0.0004) {
      setRegion(r);
      fetchReverseGeocode(r.latitude, r.longitude);
    }
  }, [region, fetchReverseGeocode]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.iconBox}><Ionicons name="location" size={16} color={COLORS.primary} /></View>
          <Text style={styles.title}>RESIDENTIAL PROTOCOL</Text>
        </View>
        <TouchableOpacity style={styles.currentLocBtn} onPress={syncToCurrentLocation} disabled={isLocating}>
          {isLocating ? <ActivityIndicator size="small" color={COLORS.primary} /> : (
            <><Ionicons name="navigate" size={14} color={COLORS.primary} /><Text style={styles.currentLocText}>USE GPS</Text></>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={region}
          onRegionChangeComplete={onRegionChangeComplete}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          <Circle center={region} radius={accuracy} fillColor="rgba(24, 0, 173, 0.05)" strokeColor="rgba(24, 0, 173, 0.15)" strokeWidth={1} />
        </MapView>
        
        <View style={styles.markerOverlay} pointerEvents="none">
          <Animated.View style={[styles.markerPin, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.markerInner} />
          </Animated.View>
          <View style={styles.markerShadow} />
        </View>
      </View>

      <View style={styles.formGrid}>
        <Input 
          label="Full Street Address"
          value={initialAddress.address}
          onChangeText={(v: string) => handleUpdate('address', v)}
          onBlur={handleManualGeocode}
          multiline
          numberOfLines={2}
          style={styles.addressInput}
          placeholder="House/Flat No, Sector, Landmark"
          success={successFields.address}
          leftIcon={<Ionicons name="home-outline" size={18} color={COLORS.slate[400]} />}
        />

        <Input 
          label="City / Locality"
          value={initialAddress.city}
          onChangeText={(v: string) => handleUpdate('city', v)}
          onBlur={handleManualGeocode}
          placeholder="Search city"
          success={successFields.city}
          leftIcon={<Ionicons name="business-outline" size={18} color={COLORS.slate[400]} />}
        />

        <Input 
          label="District"
          value={initialAddress.district}
          onChangeText={(v: string) => handleUpdate('district', v)}
          onBlur={handleManualGeocode}
          placeholder="Enter district"
          success={successFields.district}
          leftIcon={<MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={COLORS.slate[400]} />}
        />

        <View style={styles.row}>
          <View style={{ flex: 1.4 }}>
            <Input 
              label="State"
              value={initialAddress.state}
              onChangeText={(v: string) => handleUpdate('state', v)}
              onBlur={handleManualGeocode}
              placeholder="State"
              success={successFields.state}
              leftIcon={<Ionicons name="map-outline" size={18} color={COLORS.slate[400]} />}
            />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Input 
              label="Pincode"
              value={initialAddress.pincode}
              onChangeText={(v: string) => handleUpdate('pincode', v)}
              onBlur={handleManualGeocode}
              keyboardType="numeric"
              maxLength={6}
              placeholder="000000"
              error={fieldErrors.pincode || errorPincode}
              success={successFields.pincode && !fieldErrors.pincode}
            />
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFF', borderRadius: RADIUS.xl, padding: SPACING.l, marginBottom: SPACING.m, ...SHADOWS.soft, borderWidth: 1, borderColor: '#EDF2F7' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.m },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(24, 0, 173, 0.05)', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 11, fontWeight: '900', color: COLORS.slate[500], letterSpacing: 1.2 },
  currentLocBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(24, 0, 173, 0.05)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  currentLocText: { fontSize: 10, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 },
  mapContainer: { height: vs(200), borderRadius: RADIUS.lg, overflow: 'hidden', marginVertical: SPACING.s, backgroundColor: '#F1F5F9' },
  map: { flex: 1 },
  markerOverlay: { position: 'absolute', top: '50%', left: '50%', marginLeft: -15, marginTop: -35, alignItems: 'center' },
  markerPin: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, borderWidth: 4, borderColor: '#FFF', ...SHADOWS.medium, justifyContent: 'center', alignItems: 'center' },
  markerInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  markerShadow: { width: 12, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.2)', marginTop: 4 },
  formGrid: { marginTop: SPACING.m },
  addressInput: { minHeight: vs(70), fontWeight: 'bold' },
  row: { flexDirection: 'row' },
});

export default LocationPicker;
