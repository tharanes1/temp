import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, RADIUS } from '@/shared/theme';

interface KycCardProps {
  icon: string;
  title: string;
  sub: string;
  status: boolean;
  onPress: () => void;
}

export const KycCard = ({ icon, title, sub, status, onPress }: KycCardProps) => (
  <TouchableOpacity 
    style={styles.card} 
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.iconContainer, status ? styles.iconSuccess : styles.iconPending]}>
      <MaterialCommunityIcons 
        name={icon as any} 
        size={24} 
        color={status ? '#10B981' : COLORS.primary} 
      />
    </View>
    <View style={styles.cardContent}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={[styles.cardSub, status && { color: '#10B981' }]}>{sub}</Text>
    </View>
    <Ionicons 
      name={status ? "checkmark-circle" : "chevron-forward"} 
      size={22} 
      color={status ? '#10B981' : COLORS.slate[300]} 
    />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    padding: 16, 
    borderRadius: RADIUS.xl, 
    marginBottom: 12, 
    ...SHADOWS.soft, 
    borderWidth: 1, 
    borderColor: '#EDF2F7' 
  },
  iconContainer: { 
    width: 48, 
    height: 48, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  iconSuccess: { backgroundColor: '#10B98115' },
  iconPending: { backgroundColor: COLORS.primary + '10' },
  cardContent: { flex: 1, marginLeft: 16 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.slate[800] },
  cardSub: { fontSize: 12, color: '#10B981', fontWeight: '600', marginTop: 2 },
});
