import React, { forwardRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/shared/theme';
import { ms, vs } from '@/shared/utils/responsive';

type ProfileHeaderProps = {
  riderName: string;
  kycPhone: string;
  profileImage: string | null;
  onEditPhoto: () => void;
  onShowMenu: () => void;
  onLayout?: (event: any) => void;
  rating?: string;
};

export const ProfileHeader = forwardRef<View, ProfileHeaderProps>((props, ref) => {
  const {
    riderName,
    kycPhone,
    profileImage,
    onEditPhoto,
    onShowMenu,
    onLayout,
  } = props;
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={styles.headerSection} ref={ref} onLayout={onLayout}>
      <LinearGradient
        colors={["#1800ad", "#2563EB"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      />
      <View style={styles.blob1} />
      <View style={styles.blob2} />
      <SafeAreaView edges={["top"]} style={styles.safeHeader}>
        <View style={styles.topNav}>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/home")}
            style={styles.iconBtn}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.helpBadge}
              onPress={() => router.push("/help-center")}
            >
              <Text style={styles.helpText}>{t("profile.help")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onShowMenu}
            >
              <MaterialCommunityIcons
                name="dots-vertical"
                size={24}
                color="#FFF"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileInfoMain}>
          <Text style={styles.userName}>{riderName}</Text>
          <Text style={styles.userPhone}>{kycPhone}</Text>

          <View style={styles.headerAvatarContainer}>
            <TouchableOpacity activeOpacity={0.8} onPress={onEditPhoto}>
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.headerAvatar}
                />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <Ionicons name="camera" size={32} color="#FFF" />
                </View>
              )}
              <View style={styles.editBadge}>
                <MaterialCommunityIcons
                  name="camera"
                  size={14}
                  color="#FFF"
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
});

ProfileHeader.displayName = 'ProfileHeader';

const styles = StyleSheet.create({
  headerSection: {
    height: vs(240),
    borderBottomLeftRadius: ms(45),
    borderBottomRightRadius: ms(45),
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
  safeHeader: {
    paddingHorizontal: SPACING.l,
  },
  topNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACING.m,
  },
  iconBtn: {
    width: ms(44),
    height: ms(44),
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.m,
  },
  helpBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: SPACING.m,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  helpText: {
    ...TYPOGRAPHY.bodyLarge,
    color: "#FFF",
    fontSize: 14,
  },
  profileInfoMain: {
    marginTop: vs(30),
    position: "relative",
  },
  userName: {
    ...TYPOGRAPHY.hero,
    color: "#FFF",
    fontSize: ms(28),
  },
  userPhone: {
    ...TYPOGRAPHY.bodyLarge,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  headerAvatarContainer: {
    position: "absolute",
    right: 0,
    top: -vs(10),
  },
  headerAvatar: {
    width: ms(80),
    height: ms(80),
    borderRadius: ms(40),
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  headerAvatarPlaceholder: {
    width: ms(80),
    height: ms(80),
    borderRadius: ms(40),
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.black,
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
});
