import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ViewStyle, 
  ActivityIndicator,
  View
} from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/shared/theme';

import { LinearGradient } from 'expo-linear-gradient';
import { ms, s, vs } from '@/shared/utils/responsive';
import { SHADOWS } from '@/shared/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: React.ReactNode;
}

export const Button = ({ title, onPress, disabled, loading, style, variant = 'primary', icon }: ButtonProps) => {
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity 
      style={[
        styles.buttonBase, 
        isOutline && styles.outlineButton,
        disabled && styles.disabled, 
        style
      ]} 
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {isPrimary && !disabled ? (
        <LinearGradient
          colors={[COLORS.primary, COLORS.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      
      {loading ? (
        <ActivityIndicator color={isOutline ? COLORS.primary : COLORS.white} />
      ) : (
        <View style={styles.contentRow}>
          <Text style={[
            styles.text, 
            isOutline && { color: COLORS.primary }
          ]}>{title}</Text>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  buttonBase: {
    height: vs(60),
    borderRadius: ms(RADIUS.lg),
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    ...SHADOWS.soft,
  },
  disabled: {
    backgroundColor: COLORS.slate[300],
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
  },
  iconContainer: {
    marginLeft: ms(2),
  },
});
