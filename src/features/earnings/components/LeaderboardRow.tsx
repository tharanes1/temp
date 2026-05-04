import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const PRIMARY_BLUE = '#1800ad';

interface LeaderboardRowProps {
  item: {
    id: string;
    name: string;
    deliveries: number;
    image: string;
    rank: number;
  };
  textColor: string;
  subtextColor: string;
  cardColor: string;
  borderColor: string;
}

export const LeaderboardRow = ({
  item,
  textColor,
  subtextColor,
  cardColor,
  borderColor,
}: LeaderboardRowProps) => {
  const { t } = useTranslation();

  const renderRankIcon = (rank: number) => {
    if (rank === 1) return <FontAwesome5 name="crown" size={18} color="#FFD700" />;
    if (rank === 2) return <MaterialCommunityIcons name="medal" size={20} color="#C0C0C0" />;
    if (rank === 3) return <MaterialCommunityIcons name="medal" size={20} color="#CD7F32" />;
    return <Text style={[styles.rankText, { color: subtextColor }]}>#{rank}</Text>;
  };

  return (
    <View 
      style={[styles.riderCard, { backgroundColor: cardColor, borderColor: borderColor }]}
    >
      <View style={styles.riderInfo}>
        <View style={styles.rankBadge}>
          {renderRankIcon(item.rank)}
        </View>
        <Image source={{ uri: item.image }} style={styles.avatar} />
        <View style={styles.nameStack}>
          <Text style={[styles.riderName, { color: textColor }]}>{item.name}</Text>
          <Text style={[styles.deliverySub, { color: subtextColor }]}>{item.deliveries} {t('leaderboard.deliveries')}</Text>
        </View>
      </View>
      
      <View style={styles.statsBox}>
        <Text style={styles.deliveryCount}>{item.deliveries}</Text>
        <Text style={[styles.deliveryLabel, { color: subtextColor }]}>{t('leaderboard.deliveries')}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  riderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 24,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankBadge: {
    width: 30,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '900',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  nameStack: {
    gap: 2,
  },
  riderName: {
    fontSize: 16,
    fontWeight: '800',
  },
  deliverySub: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsBox: {
    alignItems: 'flex-end',
  },
  deliveryCount: {
    fontSize: 18,
    fontWeight: '900',
    color: PRIMARY_BLUE,
  },
  deliveryLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  }
});
