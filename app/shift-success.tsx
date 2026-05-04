import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@/shared/theme';
import { ms, vs } from '@/shared/utils/responsive';

export default function ShiftSuccess() {
  const router = useRouter();
  const { t } = useTranslation();
  const scaleAnim = new Animated.Value(0);
  const opacityAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#1800ad', '#2563EB']}
        style={StyleSheet.absoluteFillObject}
      />
      
      <View style={styles.content}>
        <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.whiteCircle}>
            <Ionicons name="checkmark-sharp" size={ms(60)} color={COLORS.primary} />
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: opacityAnim, alignItems: 'center' }}>
          <Text style={styles.title}>{t('shifts.success_title', 'Planner Updated!')}</Text>
          <Text style={styles.subtitle}>
            {t('shifts.success_sub', 'Your operational presets have been saved. You\'ll receive mission pings based on your updated schedule.')}
          </Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { opacity: opacityAnim }]}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => router.replace('/(tabs)/shifts')}
        >
          <Text style={styles.buttonText}>{t('shifts.return_btn', 'Return to Shifts')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  content: {
    alignItems: 'center',
    marginBottom: vs(100),
  },
  iconContainer: {
    width: ms(120),
    height: ms(120),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  whiteCircle: {
    width: ms(100),
    height: ms(100),
    borderRadius: ms(50),
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: '#FFF',
    fontSize: ms(28),
    textAlign: 'center',
    marginBottom: SPACING.m,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyLarge,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.l,
  },
  footer: {
    position: 'absolute',
    bottom: vs(50),
    width: '100%',
    paddingHorizontal: SPACING.xl,
  },
  button: {
    backgroundColor: '#FFF',
    height: vs(56),
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  buttonText: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.primary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
