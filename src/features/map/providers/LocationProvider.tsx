import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';

import socketClient from '@/services/socket/socketClient';

interface LocationData {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  accuracy?: number | null;
}

interface LocationContextType {
  location: LocationData | null;
  errorMsg: string | null;
  isTracking: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
}

export const LocationContext = createContext<LocationContextType | undefined>(undefined);

const STREAM_THROTTLE_MS = 5_000;
const STREAM_DISTANCE_M = 10;

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastSentRef = useRef<{ ts: number; lat: number; lng: number } | null>(null);

  // Distance-haversine in metres (cheap small-angle approx).
  const moveDistanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const dLat = (b.lat - a.lat) * 111_111;
    const dLng = (b.lng - a.lng) * 111_111 * Math.cos((a.lat * Math.PI) / 180);
    return Math.sqrt(dLat * dLat + dLng * dLng);
  };

  const onPosition = useCallback((newLocation: Location.LocationObject) => {
    const next: LocationData = {
      latitude: newLocation.coords.latitude,
      longitude: newLocation.coords.longitude,
      heading: newLocation.coords.heading,
      speed: newLocation.coords.speed,
      accuracy: newLocation.coords.accuracy,
    };
    setLocation(next);

    // Throttled stream to the socket gateway: at most every 5s OR every 10m.
    const last = lastSentRef.current;
    const nowMs = newLocation.timestamp ?? Date.now();
    const farEnough =
      !last ||
      moveDistanceMeters(
        { lat: last.lat, lng: last.lng },
        { lat: next.latitude, lng: next.longitude },
      ) >= STREAM_DISTANCE_M;
    const longEnough = !last || nowMs - last.ts >= STREAM_THROTTLE_MS;

    if (farEnough && longEnough && socketClient.connected) {
      socketClient.emitLocationUpdate({
        latitude: next.latitude,
        longitude: next.longitude,
        heading: next.heading ?? undefined,
        speed: next.speed ?? undefined,
        accuracy: next.accuracy ?? undefined,
        capturedAt: nowMs,
      });
      lastSentRef.current = { ts: nowMs, lat: next.latitude, lng: next.longitude };
    }
  }, []);

  const startTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setErrorMsg('Permission to access location was denied');
      return;
    }

    setIsTracking(true);
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: STREAM_DISTANCE_M,
        timeInterval: STREAM_THROTTLE_MS,
      },
      onPosition,
    );
    subscriptionRef.current = sub;
  }, [onPosition]);

  const stopTracking = useCallback(async () => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    lastSentRef.current = null;
    setIsTracking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (subscriptionRef.current) subscriptionRef.current.remove();
    };
  }, []);

  return (
    <LocationContext.Provider value={{ location, errorMsg, isTracking, startTracking, stopTracking }}>
      {children}
    </LocationContext.Provider>
  );
};
