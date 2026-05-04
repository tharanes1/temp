import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-safe-area-context';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { AppProvider } from '@/core/providers/AppProvider';
import { ThemeProvider } from '@/core/providers/ThemeProvider';
import { useSettings } from '@/core/providers/SettingsContext';
import AppTour from '@/shared/components/feedback/AppTour';
import '@/i18n';

function ThemedApp() {
  const { darkMode } = useSettings();
  
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
        <Stack.Screen name="index" options={{ gestureEnabled: false }} />
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="otp" />
        <Stack.Screen name="kyc" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="warning" />
        <Stack.Screen name="instructions" options={{ presentation: 'modal' }} />
        <Stack.Screen name="heatmap" options={{ presentation: 'modal' }} />
        <Stack.Screen name="cashinhand" options={{ presentation: 'modal' }} />
        <Stack.Screen name="alerts" />
        <Stack.Screen name="active-navigation" />
        <Stack.Screen name="delivery-request" />
        <Stack.Screen name="profile-details" options={{ presentation: 'card' }} />
        <Stack.Screen name="digital-documents" options={{ presentation: 'card' }} />
        <Stack.Screen name="vehicle-info" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings" options={{ presentation: 'card' }} />
        <Stack.Screen name="payment-history" options={{ presentation: 'card' }} />
        <Stack.Screen name="emergency-contacts" options={{ presentation: 'card' }} />
        <Stack.Screen name="bank-accounts" options={{ presentation: 'card' }} />
        <Stack.Screen name="help-center" options={{ presentation: 'card' }} />
        <Stack.Screen name="privacy-policy" options={{ presentation: 'card' }} />
        <Stack.Screen name="terms-of-service" options={{ presentation: 'card' }} />
        <Stack.Screen name="app-guide" options={{ presentation: 'card' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
      </Stack>
      <AppTour />
      <StatusBar style={darkMode ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <ThemedApp />
    </AppProvider>
  );
}
