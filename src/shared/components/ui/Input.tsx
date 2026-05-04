import React, { useEffect, useState } from 'react';
import { 
  TextInput, 
  View, 
  StyleSheet, 
  TextInputProps,
  Text,
  Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '@/shared/theme';
import { ms, s, vs } from '@/shared/utils/responsive';

interface InputProps extends TextInputProps {
  label?: string;
  disallowSpecialChars?: boolean;
  autoSaveKey?: string;
  prefix?: string;
  error?: string;
  success?: boolean;
  leftIcon?: React.ReactNode;
}

export const Input = ({ label, disallowSpecialChars, autoSaveKey, value, onChangeText, prefix, error, success, leftIcon, ...props }: InputProps) => {
  const [internalValue, setInternalValue] = useState(value || '');
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  useEffect(() => {
    if (autoSaveKey && !value) {
      const hydrate = async () => {
        const savedValue = await AsyncStorage.getItem(autoSaveKey);
        if (savedValue) {
          setInternalValue(savedValue);
          if (onChangeText) onChangeText(savedValue);
        }
      };
      hydrate();
    }
  }, [autoSaveKey]);

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  const handleChangeText = async (text: string) => {
    let filteredText = text;
    if (disallowSpecialChars) {
      filteredText = text.replace(/[^a-zA-Z0-9\s]/g, '');
    }
    setInternalValue(filteredText);
    if (onChangeText) onChangeText(filteredText);
    if (autoSaveKey) {
      try {
        await AsyncStorage.setItem(autoSaveKey, filteredText);
      } catch (e) {
        console.error('AutoSave error:', e);
      }
    }
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? '#EF4444' : (success ? '#334155' : '#E2E8F0'),
      error ? '#EF4444' : COLORS.primary
    ]
  });

  const borderWidth = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.5, 2]
  });

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: isFocused ? COLORS.primary : COLORS.slate[500] }]}>{label}</Text>}
      <Animated.View style={[
        styles.inputWrapper, 
        { borderColor, borderWidth, backgroundColor: isFocused ? '#F8FAFC' : '#FFF' }
      ]}>
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}
        {prefix && (
          <View style={styles.prefixContainer}>
            <Text style={styles.prefixText}>{prefix}</Text>
            <View style={styles.separator} />
          </View>
        )}
        <TextInput
          style={[styles.input, props.style]}
          placeholderTextColor="#94A3B8"
          value={internalValue}
          onChangeText={handleChangeText}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
      </Animated.View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: vs(SPACING.m),
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  inputWrapper: {
    height: vs(56),
    borderRadius: RADIUS.lg,
    paddingHorizontal: ms(SPACING.m),
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.soft,
  },
  prefixContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: ms(12),
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginRight: ms(10),
  },
  separator: {
    width: 1,
    height: vs(24),
    backgroundColor: '#E2E8F0',
  },
  leftIconContainer: {
    marginRight: ms(10),
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '600'
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600'
  },
});
