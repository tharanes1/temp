import React from "react";
import { Image, StyleSheet, View, ViewStyle } from "react-native";

interface BottomDecorProps {
  style?: ViewStyle;
  opacity?: number;
  zIndex?: number;
}

export const BottomDecor: React.FC<BottomDecorProps> = ({
  style,
  opacity = 1,
  zIndex = -1,
}) => {
  return (
    <View
      style={[styles.bottomDecor, { opacity, zIndex }, style]}
      pointerEvents="none"
    >
      <Image
        source={require("@/assets/images/rider_illustration.png")}
        style={styles.decorImg}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  bottomDecor: {
    position: "absolute",
    bottom: 20,
    right: -30,
    width: 250,
    height: 250,
  },
  decorImg: {
    width: "100%",
    height: "100%",
  },
});
