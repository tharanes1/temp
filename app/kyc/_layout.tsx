import { Stack } from 'expo-router';

export default function KYCLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="personal" />
      <Stack.Screen name="document-verification" />
      <Stack.Screen name="category" />
      <Stack.Screen name="student" />
      <Stack.Screen name="disabled" />
    </Stack>
  );
}
