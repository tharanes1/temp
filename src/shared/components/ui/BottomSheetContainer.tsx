import React from 'react';
import { 
  View, 
  StyleSheet, 
  Dimensions 
} from 'react-native';
import { COLORS, RADIUS, SPACING } from '@/shared/theme';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');

interface BottomSheetContainerProps {
  children: React.ReactNode;
}

export const BottomSheetContainer = ({ children }: BottomSheetContainerProps) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) + SPACING.xl }]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    width: '100%',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
});
