import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { MapView, Circle, PROVIDER_GOOGLE } from '@/shared/components/map/MapView';
import { useLocation } from '@/features/map/hooks/useLocation';
import { useDemandData, DemandPoint } from '@/features/home/hooks/useDemandData';

const { width } = Dimensions.get('window');

export interface DemandHeatmapRef {
  locateUser: () => void;
}

export const DemandHeatmap = forwardRef<DemandHeatmapRef, { isFullScreen?: boolean }>(
  ({ isFullScreen = false }, ref) => {
    const { location } = useLocation();
    const { demandPoints } = useDemandData();
    const mapRef = useRef<MapView>(null);

    const locateUser = () => {
      if (mapRef.current && location) {
        mapRef.current.animateToRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 1000);
      }
    };

    useImperativeHandle(ref, () => ({
      locateUser
    }));

    useEffect(() => {
      if (location) {
        locateUser();
      }
    }, [location?.latitude, location?.longitude]);

    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: location?.latitude || 12.9716,
            longitude: location?.longitude || 77.5946,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
          scrollEnabled={true}
          zoomEnabled={true}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {demandPoints.map((point: DemandPoint) => (
            <React.Fragment key={point.id}>
              <Circle
                center={{ latitude: point.latitude, longitude: point.longitude }}
                radius={400}
                fillColor={point.weight > 0.7 
                  ? 'rgba(239, 68, 68, 0.15)' 
                  : point.weight > 0.4 
                  ? 'rgba(245, 158, 11, 0.15)' 
                  : 'rgba(16, 185, 129, 0.1)'}
                strokeColor="transparent"
              />
              <Circle
                center={{ latitude: point.latitude, longitude: point.longitude }}
                radius={150}
                fillColor={point.weight > 0.7 
                  ? 'rgba(239, 68, 68, 0.4)' 
                  : point.weight > 0.4 
                  ? 'rgba(245, 158, 11, 0.4)' 
                  : 'rgba(16, 185, 129, 0.4)'}
                strokeColor="transparent"
              />
            </React.Fragment>
          ))}
        </MapView>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
