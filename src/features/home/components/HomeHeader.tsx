import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface HomeHeaderProps {
  greeting: string;
  riderName: string;
  profileImage: string | null;
  onLayout: (event: any) => void;
}

export const HomeHeader = React.forwardRef<View, HomeHeaderProps>(({ 
  greeting, 
  riderName, 
  profileImage, 
  onLayout 
}, ref) => {
  const router = useRouter();

  return (
    <View 
      style={styles.topRow} 
      ref={ref}
      onLayout={onLayout}
    >
      <View style={styles.greetingSection}>
        <Text style={styles.timeText}>{greeting}</Text>
        <Text style={styles.riderName}>{riderName || "Rider"}</Text>
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push("/instructions")}
        >
          <Feather name="info" size={22} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push("/notifications")}
        >
          <Feather name="bell" size={22} color="#FFF" />
          <View style={styles.notiDot} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/profile")}
          activeOpacity={0.7}
        >
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {riderName?.charAt(0) || "R"}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
    marginBottom: 25,
  },
  greetingSection: { flex: 1 },
  timeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  riderName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: -0.5,
  },
  headerActions: { flexDirection: "row", gap: 14, alignItems: "center" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  notiDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "#1800ad",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
  },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { fontSize: 16, fontWeight: "700", color: "#1800ad" },
});
