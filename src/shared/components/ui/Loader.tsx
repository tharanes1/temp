import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export const Loader = () => (
  <View style={styles.container}>
    <ActivityIndicator size="large" color="#1800ad" />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
