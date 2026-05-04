import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

interface PodiumRider {
  name: string;
  deliveries: number;
  image: string;
}

interface LeaderboardPodiumProps {
  topThree: PodiumRider[];
  textColor: string;
}

export const LeaderboardPodium = ({ topThree, textColor }: LeaderboardPodiumProps) => {
  return (
    <View style={styles.podiumWrapper}>
      {/* 2nd Place */}
      <View style={[styles.podiumItem, styles.podium2]}>
        <View style={styles.podiumAvatarWrap}>
          <Image source={{ uri: topThree[1].image }} style={[styles.podiumAvatar, { borderColor: '#C0C0C0' }]} />
          <View style={[styles.rankCircle, { backgroundColor: '#C0C0C0' }]}>
            <Text style={styles.rankCircleText}>2</Text>
          </View>
        </View>
        <Text style={[styles.podiumName, { color: textColor }]} numberOfLines={1}>{topThree[1].name.split(' ')[0]}</Text>
        <Text style={styles.podiumScore}>{topThree[1].deliveries}</Text>
        <LinearGradient colors={['#E2E8F0', '#CBD5E1']} style={[styles.podiumBase, { height: 60 }]} />
      </View>

      {/* 1st Place */}
      <View style={[styles.podiumItem, styles.podium1]}>
        <View style={styles.podiumAvatarWrap}>
          <View style={styles.crownWrap}>
            <FontAwesome5 name="crown" size={20} color="#FFD700" />
          </View>
          <Image source={{ uri: topThree[0].image }} style={[styles.podiumAvatar, { borderColor: '#FFD700', width: 80, height: 80, borderRadius: 40 }]} />
          <View style={[styles.rankCircle, { backgroundColor: '#FFD700' }]}>
            <Text style={styles.rankCircleText}>1</Text>
          </View>
        </View>
        <Text style={[styles.podiumName, { color: textColor, fontWeight: '900' }]} numberOfLines={1}>{topThree[0].name.split(' ')[0]}</Text>
        <Text style={[styles.podiumScore, { color: PRIMARY_BLUE }]}>{topThree[0].deliveries}</Text>
        <LinearGradient colors={['#FFD700', '#F59E0B']} style={[styles.podiumBase, { height: 100 }]} />
      </View>

      {/* 3rd Place */}
      <View style={[styles.podiumItem, styles.podium3]}>
        <View style={styles.podiumAvatarWrap}>
          <Image source={{ uri: topThree[2].image }} style={[styles.podiumAvatar, { borderColor: '#CD7F32' }]} />
          <View style={[styles.rankCircle, { backgroundColor: '#CD7F32' }]}>
            <Text style={styles.rankCircleText}>3</Text>
          </View>
        </View>
        <Text style={[styles.podiumName, { color: textColor }]} numberOfLines={1}>{topThree[2].name.split(' ')[0]}</Text>
        <Text style={styles.podiumScore}>{topThree[2].deliveries}</Text>
        <LinearGradient colors={['#FFEDD5', '#FED7AA']} style={[styles.podiumBase, { height: 40 }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  podiumWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 30,
    gap: 10,
  },
  podiumItem: {
    alignItems: 'center',
    width: (width - 70) / 3,
  },
  podium1: {
    zIndex: 10,
  },
  podium2: {
    zIndex: 5,
  },
  podium3: {
    zIndex: 5,
  },
  podiumAvatarWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  podiumAvatar: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    borderWidth: 3,
    backgroundColor: '#E2E8F0',
  },
  crownWrap: {
    position: 'absolute',
    top: -25,
    zIndex: 1,
  },
  rankCircle: {
    position: 'absolute',
    bottom: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  rankCircleText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
  },
  podiumName: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  podiumScore: {
    fontSize: 14,
    fontWeight: '900',
    color: '#64748B',
    marginBottom: 10,
  },
  podiumBase: {
    width: '100%',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
});
