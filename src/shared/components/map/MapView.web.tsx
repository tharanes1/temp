/**
 * Web stub for `react-native-maps`.
 *
 * Metro resolves `.web.tsx` before `.tsx` when `platform=web`, so this
 * file replaces the native re-export.  All named exports mirror the API
 * surface used across the app so existing call-sites compile without
 * changes, but render a graceful "Map not available" placeholder
 * instead of crashing the bundler.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/* ------------------------------------------------------------------ */
/*  Stub provider constants                                           */
/* ------------------------------------------------------------------ */
export const PROVIDER_GOOGLE = 'google' as const;
export const PROVIDER_DEFAULT = null;

/* ------------------------------------------------------------------ */
/*  MapView                                                           */
/* ------------------------------------------------------------------ */
export const MapView = React.forwardRef<View, any>(
  ({ style, children, ...rest }, ref) => (
    <View ref={ref} style={[styles.container, style]} {...rest}>
      <View style={styles.inner}>
        <Text style={styles.icon}>🗺️</Text>
        <Text style={styles.title}>Map View</Text>
        <Text style={styles.subtitle}>Maps are available on native devices</Text>
      </View>
      {/* Render children (markers etc.) invisibly so React doesn't warn */}
      <View style={styles.hidden}>{children}</View>
    </View>
  ),
);

MapView.displayName = 'MapView';

/* ------------------------------------------------------------------ */
/*  Marker                                                            */
/* ------------------------------------------------------------------ */
export const Marker: React.FC<any> = ({ children }) => (
  <View style={styles.hidden}>{children}</View>
);

/* ------------------------------------------------------------------ */
/*  Polyline                                                          */
/* ------------------------------------------------------------------ */
export const Polyline: React.FC<any> = () => null;

/* ------------------------------------------------------------------ */
/*  Circle                                                            */
/* ------------------------------------------------------------------ */
export const Circle: React.FC<any> = () => null;

/* ------------------------------------------------------------------ */
/*  Default export (some call-sites may still use `import MapView`)   */
/* ------------------------------------------------------------------ */
export default MapView;

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 16,
    minHeight: 200,
  },
  inner: {
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  hidden: {
    display: 'none',
  },
});
