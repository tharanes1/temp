import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Image,
  Text,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '@/core/providers/UserContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TAB_BAR_HEIGHT = 70;
const HORIZONTAL_SPACING = 20;
const PRIMARY_BLUE = '#1800ad';

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { riderName, profileImage } = useUser();
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH - HORIZONTAL_SPACING * 2);

  const translateX = useSharedValue(0);

  const routes = state.routes.filter(r => r.name !== 'explore' && r.name !== 'index');
  const activeIndex = routes.findIndex(r => r.name === state.routes[state.index].name);
  
  const tabWidth = containerWidth / routes.length;

  useEffect(() => {
    if (activeIndex !== -1) {
      translateX.value = withTiming(activeIndex * tabWidth, {
        duration: 250,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
      });
    }
  }, [activeIndex, tabWidth]);

  const animatedBlobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: tabWidth,
    opacity: withTiming(activeIndex === -1 ? 0 : 1, { duration: 200 }),
  }));

  const onLayout = (e: any) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  return (
    <View style={[
      styles.floatingContainer, 
      { 
        bottom: insets.bottom > 0 ? insets.bottom : 20, 
        marginHorizontal: HORIZONTAL_SPACING 
      }
    ]}>
      <View style={styles.pillContainer}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 255, 255, 0.95)' }]} />
        )}
        
        {/* ACTIVE BLOB */}
        <Animated.View style={[styles.activeBlob, animatedBlobStyle]}>
          <LinearGradient
            colors={['#1800ad', '#1655D9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.blobGradient}
          />
        </Animated.View>

        {/* TABS ITEMS */}
        <View style={styles.tabsRow} onLayout={onLayout}>
          {routes.map((route, index) => {
            const isFocused = activeIndex === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate(route.name);
              }
            };

            return (
              <TabItem
                key={route.key}
                route={route}
                isFocused={isFocused}
                onPress={onPress}
                profileImage={profileImage}
                riderName={riderName}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

function TabItem({ route, isFocused, onPress, profileImage, riderName }: any) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const renderIcon = () => {
    const color = isFocused ? "#FFFFFF" : "#94A3B8";
    const size = 24;

    if (route.name === "profile") {
      return (
        <View style={[styles.avatarWrapper, isFocused && styles.avatarActiveBorder]}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatarImage} />
          ) : riderName ? (
            <View style={styles.initialsCircle}>
              <Text style={styles.initialsText}>{riderName.charAt(0)}</Text>
            </View>
          ) : (
            <Ionicons name="person" size={size} color={color} />
          )}
        </View>
      );
    }

    let iconName = "home-outline";
    let Library: any = Ionicons;

    switch (route.name) {
      case "home":
        iconName = isFocused ? "home" : "home-outline";
        break;
      case "orders":
        Library = MaterialCommunityIcons;
        iconName = isFocused ? "package-variant" : "package-variant-closed";
        break;
      case "earnings":
        Library = MaterialCommunityIcons;
        iconName = isFocused ? "wallet" : "wallet-outline";
        break;
      case "shifts":
        Library = MaterialCommunityIcons;
        iconName = isFocused ? "calendar-clock" : "calendar-clock-outline";
        break;
    }

    return <Library name={iconName} size={size} color={color} />;
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItem}
    >
      <Animated.View style={[styles.iconContainer, animatedStyle]}>
        {renderIcon()}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  pillContainer: {
    height: TAB_BAR_HEIGHT,
    borderRadius: 35,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  tabsRow: {
    flex: 1,
    flexDirection: "row",
    height: '100%',
  },
  tabItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  activeBlob: {
    position: "absolute",
    height: 50,
    borderRadius: 25,
    top: (TAB_BAR_HEIGHT - 50) / 2,
    paddingHorizontal: 5,
  },
  blobGradient: {
    flex: 1,
    borderRadius: 25,
    shadowColor: '#1800ad',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 4,
  },
  avatarWrapper: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  avatarActiveBorder: {
    borderColor: "#FFF",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  initialsCircle: {
    flex: 1,
    backgroundColor: PRIMARY_BLUE,
    justifyContent: "center",
    alignItems: "center",
  },
  initialsText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "900",
  },
});
