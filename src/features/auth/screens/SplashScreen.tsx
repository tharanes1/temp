import { View, Image, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../state/authStore';
import { kycService } from '@/services/api/features/kyc';
import * as SplashScreen from 'expo-splash-screen';
import { ms, vs } from '@/shared/utils/responsive';


// Keep native splash visible while we load
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Splash() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const progressWidth = useSharedValue<number>(0);
  const stripeOffset = useSharedValue(0);
  const { initialize, isAuthenticated } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        // Start animations
        progressWidth.value = withTiming(100, { 
          duration: 3500, 
          easing: Easing.bezier(0.25, 0.1, 0.25, 1)
        });

        stripeOffset.value = withRepeat(
          withTiming(-40, { duration: 600, easing: Easing.linear }),
          -1,
          false
        );

        // Actual session check
        await initialize();
        
        // Hide native splash early so we see the JS animation
        setTimeout(async () => {
          await SplashScreen.hideAsync();
        }, 500);

        // Wait for JS animation to finish before navigating
        setTimeout(async () => {
          setIsReady(true);
        }, 3800);
      } catch (e) {
        console.error('Splash error:', e);
        await SplashScreen.hideAsync();
        setIsReady(true);
      }
    };

    prepare();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    // Source of truth: backend /kyc/status (replaces the always-empty
    // legacy `@kyc_status` AsyncStorage key).  On any error the safer
    // default is to keep the rider in /kyc rather than letting them into
    // /(tabs) without verified KYC.
    kycService
      .getStatus()
      .then((s) => {
        if (s.status === 'verified') router.replace('/(tabs)/home');
        else router.replace('/kyc');
      })
      .catch(() => {
        router.replace('/kyc');
      });
  }, [isReady, isAuthenticated, router]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const stripesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: stripeOffset.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* MESH GRADIENT DECORATIONS */}
      <View style={styles.blurBlob1} />
      <View style={styles.blurBlob2} />
      <View style={styles.blurBlob3} />
      
      <LinearGradient
        colors={['#000B1A', '#2563EB', '#000B1A']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* BRAND SECTION */}
      <View style={styles.brandContainer}>
        <View style={styles.logoWrapper}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.appName}>Cravix</Text>
        <Text style={styles.tagline}>{t('splash.tagline')}</Text>
      </View>
      
      {/* PROGRESS TRACKER & STATUS */}
      <View style={[styles.progressContainer, { bottom: Math.max(insets.bottom, 20) + vs(40) }]}>
        {/* INTEGRATED STATUS SECTION */}
        <View style={styles.statusSection}>
          <View style={styles.sessionPill}>
            <ActivityIndicator color="#ffffff" style={styles.loader} size="small" />
            <Text style={styles.statusText}>{t('splash.session_check')}</Text>
          </View>
        </View>

        <View style={styles.progressBarBase}>
          <Animated.View style={[styles.progressBarFill, progressStyle]}>
            <Animated.View style={[styles.stripeContainer, stripesStyle]}>
               <LinearGradient
                colors={['#1800ad', '#4ADE80', '#1800ad']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.stripes}
              />
               <LinearGradient
                colors={['#1800ad', '#4ADE80', '#1800ad']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.stripes}
              />
              <LinearGradient
                colors={['#1800ad', '#4ADE80', '#1800ad']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.stripes}
              />
            </Animated.View>
          </Animated.View>
        </View>
        <Text style={styles.footerText}>{t('splash.systems_ready')}</Text>
      </View>

    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  blurBlob1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: '#1655D9',
    opacity: 0.15,
  },
  blurBlob2: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 450,
    height: 450,
    borderRadius: 225,
    backgroundColor: '#2563EB',
    opacity: 0.1,
  },
  blurBlob3: {
    position: 'absolute',
    top: '40%',
    left: '20%',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#1E293B',
    opacity: 0.2,
  },
  brandContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  logoWrapper: {
    backgroundColor: '#ffffff',
    width: ms(160),
    height: ms(160),
    borderRadius: ms(35),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
    marginBottom: vs(35),
    overflow: 'hidden',
  },
  logo: {
    width: ms(135),
    height: ms(135),
    borderRadius: ms(30),
  },
  appName: {
    color: '#FFFFFF',
    fontSize: ms(54),
    fontWeight: '900',
    letterSpacing: -2,
  },
  tagline: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: ms(16),
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: vs(4),
  },
  statusSection: {
    alignItems: 'center',
    width: '100%',
    marginBottom: vs(20),
  },
  sessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: vs(14),
    paddingHorizontal: ms(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: ms(20),
  },
  loader: {
    marginRight: ms(10),
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: ms(15),
    fontWeight: '800',
    letterSpacing: 1,
  },
  progressContainer: {
    position: 'absolute',
    bottom: vs(60),
    width: '100%',
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: ms(11),
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: vs(15),
  },
  progressBarBase: {
    width: '60%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1800ad', // Primary blue
    borderRadius: 20,
    shadowColor: '#1800ad',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 8,
    overflow: 'hidden', // To clip stripes
  },
  stripeContainer: {
    flexDirection: 'row',
    width: 500, // Wide enough to slide
    height: '100%',
  },
  stripes: {
    width: 40,
    height: '100%',
  },
});
