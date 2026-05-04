import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BackHandler,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Animated,
  Image,
  ActivityIndicator,
} from "react-native";
import { ms, s, vs, SCREEN_WIDTH, SCREEN_HEIGHT, isSmallDevice } from "@/shared/utils/responsive";
import { COLORS, TYPOGRAPHY, SHADOWS } from "@/shared/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "@/core/providers/SettingsContext";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { authService } from "@/services/api/features/auth";
import { useAuthStore } from "../state/authStore";

const { width } = Dimensions.get("window");
const PRIMARY_BLUE = "#1800ad";

export default function OTP() {
  const router = useRouter();
  const { t } = useTranslation();
  const [otp, setOtp] = useState<string[]>(["", "", "", ""]);
  const [phone, setPhone] = useState("");
  const inputs = useRef<(TextInput | null)[]>([]);
  const shiftAnim = useRef(new Animated.Value(0)).current;

  // Theme support
  const bgColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const subtextColor = useThemeColor({}, "subtext");
  const cardColor = useThemeColor({}, "card");
  const borderColor = useThemeColor({}, "border");
  const cardAltColor = useThemeColor({}, "cardSecondary");
  const { darkMode } = useSettings();
  const isDark = darkMode;

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.back();
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );

      return () => subscription.remove();
    }, [router]),
  );

  useEffect(() => {
    const getPhone = async () => {
      const saved = await AsyncStorage.getItem("@temp_phone");
      if (saved) setPhone(saved);
    };
    getPhone();

    const keyboardShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        Animated.timing(shiftAnim, {
          toValue: isSmallDevice ? -120 : -80,
          duration: 300,
          useNativeDriver: true,
        }).start();
      },
    );
    const keyboardHideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        Animated.timing(shiftAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      },
    );

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, []);

  const handleChange = (text: string, index: number): void => {
    const sanitized = text.replace(/[^0-9]/g, '');
    let newOtp = [...otp];
    newOtp[index] = sanitized;
    setOtp(newOtp);

    if (text && index < 3) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleBackspace = (text: string, index: number): void => {
    if (!text && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const [isLoading, setIsLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleVerify = async (): Promise<void> => {
    if (!otp.some((d) => d === "")) {
      Keyboard.dismiss();
      setIsLoading(true);
      try {
        const otpString = otp.join("");
        // Locked A1: 4-digit OTP. Locked A2: response carries access + refresh.
        const response = await authService.verify(phone, otpString, "v1");

        if (response.success && response.data) {
          await setAuth({
            token: response.data.token,
            refreshToken: response.data.refreshToken,
            expiresIn: response.data.expiresIn,
            refreshExpiresIn: response.data.refreshExpiresIn,
            user: response.data.user,
          });
          // Branch on KYC status returned by the backend.
          if (response.data.user.isKycComplete) {
            router.replace("/(tabs)/home");
          } else {
            router.replace("/kyc");
          }
        } else {
          alert("Invalid OTP");
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : (e as { message?: string })?.message;
        // Strip OTP from any logged error to avoid PII leaks.
        if (__DEV__) console.warn("OTP verification failed");
        alert(msg ?? "Verification failed");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar style="light" />

      <Animated.View style={{ flex: 1, transform: [{ translateY: shiftAnim }] }}>
        {/* 🔴 PREMIUM HERO HEADER */}
        <View style={styles.headerHero}>
          <LinearGradient
            colors={["#1800ad", "#2563EB"]}
            style={styles.headerGradient}
          />

          {/* BLOBS */}
          <View style={styles.blob1} />
          <View style={styles.blob2} />

          <SafeAreaView edges={["top"]} style={styles.headerContent}>
            <View style={styles.navRow}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitleText}>
                {t("auth.otp.security_check")}
              </Text>
              <View style={{ width: 44 }} />
            </View>

            <View style={styles.heroMain}>
              <View style={styles.logoBox}>
                <Image 
                  source={require('@/assets/images/logo.png')} 
                  style={styles.logo} 
                  resizeMode="contain" 
                />
              </View>
              <Text style={styles.heroTag}>{t("common.verification")}</Text>
              <Text style={styles.heroTitle}>{t("auth.otp.enter_code")}</Text>
              {!isSmallDevice && (
                <View style={styles.phoneBadge}>
                  <MaterialCommunityIcons name="phone" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.heroSub}>
                    {t("auth.otp.sent_to", { phone: phone || "XXXXX-XXXXX" })}
                  </Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.formContainer}>
            <View style={styles.mainContent}>
              <View
                style={[
                  styles.authCard,
                  {
                    backgroundColor: cardColor,
                    borderColor: borderColor,
                    borderWidth: isDark ? 1 : 0,
                  },
                ]}
              >
                <View style={styles.otpRow}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => {
                        inputs.current[index] = ref;
                      }}
                      style={[
                        styles.otpInput,
                        {
                          backgroundColor: cardAltColor,
                          borderColor: borderColor,
                          color: textColor,
                        },
                        digit !== "" && {
                          borderColor: PRIMARY_BLUE,
                          backgroundColor: cardColor,
                        },
                      ]}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={digit}
                      onChangeText={(text) => handleChange(text, index)}
                      onKeyPress={({ nativeEvent }) => {
                        if (nativeEvent.key === "Backspace") {
                          handleBackspace(digit, index);
                        }
                      }}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  disabled={otp.some((d) => d === "")}
                  onPress={handleVerify}
                  style={[
                    styles.mainBtn,
                    otp.some((d) => d === "") && styles.btnDisabled,
                  ]}
                >
                  <LinearGradient
                    colors={
                      otp.some((d) => d === "")
                        ? ["#CBD5E1", "#94A3B8"]
                        : ["#1800ad", "#2563EB"]
                    }
                    style={styles.btnGrad}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.btnText}>{t("auth.otp.verify")}</Text>
                        <MaterialCommunityIcons
                          name="shield-check"
                          size={20}
                          color="#FFF"
                        />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.resendArea}>
                  <Text style={[styles.resendText, { color: subtextColor }]}>
                    {t("auth.otp.resend")}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.securitySeal}>
                <MaterialCommunityIcons
                  name="lock-check"
                  size={20}
                  color={subtextColor}
                />
                <Text style={[styles.securityText, { color: subtextColor }]}>
                  {t("auth.otp.encrypted")}
                </Text>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>
          </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerHero: {
    flex: isSmallDevice ? 0.45 : 0.5,
    backgroundColor: PRIMARY_BLUE,
    borderBottomLeftRadius: ms(50),
    borderBottomRightRadius: ms(50),
    overflow: "hidden",
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  blob1: {
    position: "absolute",
    top: -ms(40),
    right: -ms(30),
    width: ms(160),
    height: ms(160),
    borderRadius: ms(80),
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  blob2: {
    position: "absolute",
    bottom: -ms(20),
    left: -ms(40),
    width: ms(120),
    height: ms(120),
    borderRadius: ms(60),
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: 25,
    justifyContent: 'center',
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    position: 'absolute',
    top: vs(40),
    left: 25,
    right: 25,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFF",
  },
  heroMain: {
    alignItems: "center",
    gap: vs(12),
    marginTop: vs(20),
  },
  logoBox: {
    width: isSmallDevice ? ms(100) : ms(120),
    height: isSmallDevice ? ms(100) : ms(120),
    borderRadius: isSmallDevice ? ms(35) : ms(40),
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
    marginBottom: vs(5),
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: isSmallDevice ? ms(15) : ms(20),
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginTop: vs(5),
  },
  heroTag: {
    ...TYPOGRAPHY.tag,
    color: "rgba(255,255,255,0.6)",
  },
  heroTitle: {
    ...TYPOGRAPHY.h1,
    color: "#FFF",
    textAlign: "center",
    fontSize: isSmallDevice ? 24 : 28,
  },
  heroSub: {
    ...TYPOGRAPHY.body,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    paddingHorizontal: ms(20),
    fontSize: 13,
  },
  formContainer: {
    flex: isSmallDevice ? 0.55 : 0.5,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 25,
    marginTop: -vs(40),
    justifyContent: 'space-between',
    paddingBottom: vs(20),
  },
  authCard: {
    backgroundColor: '#FFF',
    borderRadius: ms(35),
    padding: ms(30),
    ...SHADOWS.high,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: vs(35),
  },
  otpInput: {
    width: (width - 160) / 4,
    height: isSmallDevice ? 65 : 75,
    borderRadius: 20,
    borderWidth: 2,
    fontSize: isSmallDevice ? 28 : 32,
    fontWeight: "900",
    textAlign: "center",
  },
  mainBtn: {
    height: isSmallDevice ? 64 : 68,
    borderRadius: 22,
    overflow: "hidden",
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
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  btnText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
  },
  resendArea: {
    marginTop: vs(25),
    alignItems: "center",
  },
  resendText: {
    fontSize: 13,
    fontWeight: "600",
  },
  securitySeal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: vs(20),
  },
  securityText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
