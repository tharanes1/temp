import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState, useRef } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  TouchableOpacity,
  View,
  Dimensions,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useTranslation } from 'react-i18next';
import { ms, s, vs, SCREEN_WIDTH, SCREEN_HEIGHT, isSmallDevice } from '@/shared/utils/responsive';
import { COLORS, TYPOGRAPHY, SHADOWS } from '@/shared/theme';
import { Input } from '@/shared/components/ui/Input';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { authService } from '@/services/api/features/auth';

const PRIMARY_BLUE = '#1800ad';

import { Alert } from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [phone, setPhone] = useState('');
  const shiftAnim = useRef(new Animated.Value(0)).current;

  const SLIDES = [
    // ... slides ...
    {
      id: 1,
      heading: t('auth.onboarding.slide1_heading'),
      subtitle: t('auth.onboarding.slide1_sub'),
    },
    {
      id: 2,
      heading: t('auth.onboarding.slide2_heading'),
      subtitle: t('auth.onboarding.slide2_sub'),
    },
    {
      id: 3,
      heading: t('auth.onboarding.slide3_heading'),
      subtitle: t('auth.onboarding.slide3_sub'),
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 4000);

    const keyboardShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.timing(shiftAnim, {
          toValue: isSmallDevice ? -120 : -80,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    );
    const keyboardHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.timing(shiftAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      clearInterval(timer);
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, []);

  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (phone.length === 10) {
      setIsLoading(true);
      try {
        const response = await authService.login(phone);
        if (response.success) {
          // Show alert instead of broken notification
          Alert.alert(
            "Code Sent",
            `A verification code has been sent to +91 ${phone}`
          );

          await AsyncStorage.setItem('@temp_phone', phone);
          router.push('/otp');
        } else {
          alert(response.message || 'Login failed');
        }
      } catch (error: any) {
        console.error('Login error:', error);
        alert(error.message || 'Network error. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Animated.View style={{ flex: 1, transform: [{ translateY: shiftAnim }] }}>
          {/* 🔴 PREMIUM HERO HEADER */}
          <View style={styles.headerHero}>
            <LinearGradient
              colors={['#1800ad', '#2563EB']}
              style={styles.headerGradient}
            />
            
            {/* BLOBS */}
            <View style={styles.blob1} />
            <View style={styles.blob2} />

            <SafeAreaView edges={['top']} style={styles.headerContent}>
              <View style={styles.logoRow}>
                <View style={styles.logoBox}>
                  <Image 
                    source={require('@/assets/images/logo.png')} 
                    style={styles.logo} 
                    resizeMode="contain" 
                  />
                </View>
              </View>

              <View style={styles.heroTextSection}>
                <Text style={styles.heroTag}>{t('auth.welcome')}</Text>
                <View style={styles.slideContent}>
                  <Text style={styles.heroTitle}>
                    {SLIDES[currentSlide].heading}
                  </Text>
                  {!isSmallDevice && (
                    <Text style={styles.heroSub}>
                      {SLIDES[currentSlide].subtitle}
                    </Text>
                  )}
                </View>
              </View>
            </SafeAreaView>
          </View>

          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.formContainer}>
              <View style={styles.mainContent}>
                <View style={styles.authCard}>
                  <Text style={styles.cardTitle}>{t('auth.ready_to_deliver')}</Text>
                  <Text style={styles.cardSub}>{t('auth.enter_mobile')}</Text>

                  <View style={styles.inputArea}>
                    <Input
                      placeholder="00000-00000"
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={phone}
                      onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ''))}
                      disallowSpecialChars={true}
                      prefix="+91"
                    />

                    <TouchableOpacity 
                      disabled={phone.length < 10}
                      onPress={handleContinue}
                      style={[styles.mainBtn, phone.length < 10 && styles.btnDisabled]}
                    >
                      <LinearGradient
                        colors={phone.length < 10 ? ['#CBD5E1', '#94A3B8'] : ['#1800ad', '#2563EB']}
                        style={styles.btnGrad}
                      >
                        {isLoading ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <>
                            <Text style={styles.btnText}>{t('auth.send_otp')}</Text>
                            <MaterialCommunityIcons name="arrow-right" size={20} color="#FFF" />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.termsText}>
                    {t('auth.terms_privacy')}
                  </Text>
                </View>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>{t('auth.footer')}</Text>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerHero: {
    flex: isSmallDevice ? 0.45 : 0.5,
    backgroundColor: PRIMARY_BLUE,
    borderBottomLeftRadius: ms(50),
    borderBottomRightRadius: ms(50),
    overflow: 'hidden',
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  blob1: {
    position: 'absolute',
    top: -ms(40),
    right: -ms(30),
    width: ms(160),
    height: ms(160),
    borderRadius: ms(80),
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  blob2: {
    position: 'absolute',
    bottom: -ms(20),
    left: -ms(40),
    width: ms(120),
    height: ms(120),
    borderRadius: ms(60),
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoRow: {
    marginBottom: vs(15),
    alignItems: 'center',
  },
  logoBox: {
    width: isSmallDevice ? ms(110) : ms(130),
    height: isSmallDevice ? ms(110) : ms(130),
    borderRadius: isSmallDevice ? ms(35) : ms(45),
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: ms(6),
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: isSmallDevice ? ms(20) : ms(25),
  },
  heroTextSection: {
    gap: vs(10),
    alignItems: 'center',
  },
  heroTag: {
    fontSize: ms(10),
    fontWeight: '900',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  slideContent: {
    alignItems: 'center',
    gap: vs(4),
    width: '100%',
  },
  heroTitle: {
    fontSize: isSmallDevice ? 24 : 28,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: isSmallDevice ? 12 : 13,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 18,
    maxWidth: '90%',
  },
  formContainer: {
    flex: isSmallDevice ? 0.55 : 0.5,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 25,
    marginTop: -vs(40),
    justifyContent: 'space-between', // Push footer to bottom
  },
  authCard: {
    backgroundColor: '#FFF',
    borderRadius: ms(35),
    padding: isSmallDevice ? ms(20) : ms(30),
    ...SHADOWS.high,
  },
  cardTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: isSmallDevice ? 20 : 22,
    color: COLORS.textPrimary,
    marginBottom: vs(4),
  },
  cardSub: {
    ...TYPOGRAPHY.body,
    fontSize: isSmallDevice ? 13 : 14,
    color: COLORS.textSecondary,
    marginBottom: vs(isSmallDevice ? 20 : 30),
  },
  inputArea: {
    gap: vs(isSmallDevice ? 15 : 20),
  },
  mainBtn: {
    height: isSmallDevice ? 64 : 68,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: PRIMARY_BLUE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  btnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  btnGrad: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  btnText: {
    color: '#FFF',
    fontSize: isSmallDevice ? 16 : 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  termsText: {
    marginTop: vs(isSmallDevice ? 15 : 25),
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: vs(20),
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
