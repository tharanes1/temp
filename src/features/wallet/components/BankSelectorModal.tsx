import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/shared/theme';

const { height } = Dimensions.get('window');

const BANKS = [
  { id: '1', name: 'State Bank of India', short: 'SBI', colors: ['#2563EB', '#1E40AF'] },
  { id: '2', name: 'HDFC Bank', short: 'HDFC', colors: ['#1E293B', '#0F172A'] },
  { id: '3', name: 'ICICI Bank', short: 'ICICI', colors: ['#EA580C', '#9A3412'] },
  { id: '4', name: 'Tamilnad Mercantile Bank', short: 'TMB', colors: ['#1E3A8A', '#1E40AF'] },
  { id: '5', name: 'Axis Bank', short: 'AXIS', colors: ['#991B1B', '#7F1D1D'] },
  { id: '6', name: 'Punjab National Bank', short: 'PNB', colors: ['#B91C1C', '#991B1B'] },
  { id: '7', name: 'Canara Bank', short: 'CANARA', colors: ['#1D4ED8', '#1E3A8A'] },
  { id: '8', name: 'Bank of Baroda', short: 'BOB', colors: ['#EA580C', '#C2410C'] },
  { id: '9', name: 'Kotak Mahindra Bank', short: 'KOTAK', colors: ['#B91C1C', '#991B1B'] },
  { id: '10', name: 'IndusInd Bank', short: 'INDUSIND', colors: ['#7C2D12', '#451A03'] },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (bank: typeof BANKS[0]) => void;
}

export default function BankSelectorModal({ visible, onClose, onSelect }: Props) {
  const [search, setSearch] = useState('');

  const filteredBanks = BANKS.filter(b => 
    b.name.toLowerCase().includes(search.toLowerCase()) || 
    b.short.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Your Bank</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.slate[600]} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={COLORS.slate[400]} />
            <TextInput
              style={styles.input}
              placeholder="Search bank name..."
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>

          <FlatList
            data={filteredBanks}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.bankItem} 
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <View style={[styles.bankIcon, { backgroundColor: item.colors[0] }]}>
                  <Text style={styles.bankShort}>{item.short[0]}</Text>
                </View>
                <View>
                  <Text style={styles.bankName}>{item.name}</Text>
                  <Text style={styles.bankSub}>{item.short}</Text>
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            contentContainerStyle={styles.listContent}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { height: height * 0.7, backgroundColor: '#FFF', borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.l, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.slate[800] },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 12, margin: SPACING.l, paddingHorizontal: 16, height: 50, borderRadius: RADIUS.lg, backgroundColor: '#F1F5F9' },
  input: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.slate[800] },
  listContent: { paddingBottom: 40 },
  bankItem: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: SPACING.l },
  bankIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  bankShort: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  bankName: { fontSize: 15, fontWeight: '800', color: COLORS.slate[800] },
  bankSub: { fontSize: 12, fontWeight: '600', color: COLORS.slate[400], marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: SPACING.l },
});
