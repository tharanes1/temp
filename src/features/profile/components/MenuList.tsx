import React, { forwardRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@/shared/theme';

type MenuListProps = {
  onLayout?: (event: any) => void;
  onShowLogout: () => void;
};

export const MenuList = forwardRef<View, MenuListProps>((props, ref) => {
  const { onLayout, onShowLogout } = props;
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View 
      style={[styles.listMenuContainer, { ...SHADOWS.soft }]} 
      ref={ref}
      onLayout={onLayout}
    >
      <MenuItem
        icon={<Ionicons name="person-outline" size={22} color={COLORS.black} />}
        label={t("profile.personal_info")}
        onPress={() => router.push("/profile-details")}
      />
      <View style={styles.divider} />
      <MenuItem
        icon={<Ionicons name="card-outline" size={22} color={COLORS.black} />}
        label={t("profile.statements")}
        onPress={() => router.push("/account-statements")}
      />
      <View style={styles.divider} />
      <MenuItem
        icon={<MaterialCommunityIcons name="gas-station-outline" size={22} color={COLORS.black} />}
        label={t("profile.fuel_allowance").replace(/\n/g, " ")}
        onPress={() => router.push("/allowance")}
      />
      <View style={styles.divider} />
      <MenuItem
        icon={<MaterialCommunityIcons name="file-document-outline" size={22} color={COLORS.black} />}
        label={t("profile.digital_docs")}
        onPress={() => router.push("/digital-documents")}
      />
      <View style={styles.divider} />
      <MenuItem
        icon={<Ionicons name="bicycle-outline" size={22} color={COLORS.black} />}
        label={t("profile.vehicle_info")}
        onPress={() => router.push("/vehicle-info")}
      />
      <View style={styles.divider} />
      <MenuItem
        icon={<Ionicons name="people-outline" size={22} color={COLORS.black} />}
        label={t("profile.emergency_contacts")}
        onPress={() => router.push("/emergency-contacts")}
      />
      <View style={styles.divider} />
      <MenuItem
        icon={<Ionicons name="help-buoy-outline" size={22} color={COLORS.black} />}
        label={t("profile.support")}
        onPress={() => router.push("/help-center")}
      />
      <View style={styles.divider} />
      <MenuItem
        icon={<Ionicons name="book-outline" size={22} color={COLORS.black} />}
        label={t("profile.app_guide")}
        onPress={() => router.push("/app-guide")}
      />
      <View style={styles.divider} />
      <MenuItem
        icon={<Ionicons name="settings-outline" size={22} color={COLORS.black} />}
        label={t("profile.settings")}
        onPress={() => router.push("/settings")}
      />
      <View style={styles.divider} />
      <MenuItem
        icon={<Ionicons name="information-circle-outline" size={22} color={COLORS.black} />}
        label={t("profile.about")}
        onPress={() =>
          Alert.alert(
            t("profile.about_alert_title"),
            t("profile.about_alert_msg", { version: "4.2.0" }),
          )
        }
      />
      <View style={styles.divider} />
      <MenuItem
        icon={<MaterialCommunityIcons name="power" size={22} color={COLORS.error} />}
        label={t("profile.logout")}
        textColor={COLORS.error}
        onPress={onShowLogout}
      />
    </View>
  );
});

MenuList.displayName = 'MenuList';

function MenuItem({ icon, label, onPress, textColor }: any) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={styles.menuItemLeft}>
        {icon}
        <Text style={[styles.menuItemLabel, textColor && { color: textColor }]}>
          {label}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.slate[300]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  listMenuContainer: {
    backgroundColor: "#FFF",
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    marginBottom: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.slate[50],
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.m,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.m,
  },
  menuItemLabel: {
    ...TYPOGRAPHY.bodyLarge,
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.slate[50],
    marginHorizontal: SPACING.m,
  },
});
