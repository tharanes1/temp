import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

interface ScreenWrapperProps {
  children: React.ReactNode;
  bg?: string;
}

export const ScreenWrapper = ({ children, bg = '#F4F7FA' }: ScreenWrapperProps) => (
  <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
    <StatusBar style="dark" />
    <View style={styles.content}>
      {children}
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  }
});
