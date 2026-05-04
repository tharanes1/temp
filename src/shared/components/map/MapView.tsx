/**
 * Platform-aware re-export of `react-native-maps`.
 *
 * On native (iOS / Android) this file is picked by Metro and simply
 * re-exports the real MapView + helpers.
 *
 * On **web**, Metro picks `MapView.web.tsx` (the `.web.tsx` extension
 * wins) which provides lightweight stubs so the bundler never hits the
 * native-only `codegenNativeCommands` import inside react-native-maps.
 */
export {
  default as MapView,
  Marker,
  Polyline,
  Circle,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
} from 'react-native-maps';
