import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useThemeColor } from '@/shared/hooks/use-theme-color';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

const STATEMENTS = [
  { id: '1', month: 'April 2024', period: 'Apr 01 - Apr 30', amount: '₹12,450.00', status: 'Available', type: 'Monthly' },
  { id: '2', month: 'March 2024', period: 'Mar 01 - Mar 31', amount: '₹15,200.50', status: 'Available', type: 'Monthly' },
  { id: '3', month: 'February 2024', period: 'Feb 01 - Feb 28', amount: '₹11,800.00', status: 'Available', type: 'Monthly' },
  { id: '4', month: 'January 2024', period: 'Jan 01 - Jan 31', amount: '₹14,500.00', status: 'Available', type: 'Monthly' },
  { id: '5', month: 'December 2023', period: 'Dec 01 - Dec 31', amount: '₹13,100.25', status: 'Available', type: 'Monthly' },
];

export default function AccountStatements() {
  const router = useRouter();
  const { t } = useTranslation();
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');

  const handleDownload = async (item: any) => {
    try {
      await Share.share({
        message: `Account Statement for ${item.month}\nAmount: ${item.amount}\nPeriod: ${item.period}`,
        title: `Statement ${item.month}`
      });
    } catch (error) {
      console.error('Share Error:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar style="light" />
      
      <View style={styles.headerHero}>
        <LinearGradient
          colors={['#1800ad', '#2563EB']}
          style={styles.headerGradient}
        />
        <View style={styles.blob1} />
        <View style={styles.blob2} />

        <SafeAreaView edges={['top']} style={styles.headerContent}>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitleText}>{t('statements.title')}</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.heroMain}>
            <Text style={styles.heroTag}>{t('statements.history_tag')}</Text>
            <Text style={styles.heroTitle}>{t('statements.title')}</Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>{t('statements.monthly_summaries')}</Text>
          
          {STATEMENTS.map((item) => (
            <View key={item.id} style={[styles.statementCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <View style={styles.cardInfo}>
                <View style={styles.iconBox}>
                  <MaterialCommunityIcons name="file-pdf-box" size={32} color="#EF4444" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={[styles.monthText, { color: textColor }]}>{item.month}</Text>
                  <Text style={[styles.periodText, { color: subtextColor }]}>{item.period}</Text>
                  <View style={styles.amountRow}>
                    <Text style={[styles.amountText, { color: PRIMARY_BLUE }]}>{item.amount}</Text>
                    <View style={styles.statusBadge}>
                       <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                  </View>
                </View>
              </View>
              
              <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownload(item)}>
                <Ionicons name="download-outline" size={20} color={PRIMARY_BLUE} />
              </TouchableOpacity>
            </View>
          ))}
          
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={subtextColor} />
            <Text style={[styles.infoText, { color: subtextColor }]}>
              {t('statements.info_note')}
            </Text>
          </View>
        </View>
      </ScrollView>
          </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerHero: { 
    height: 300, 
    backgroundColor: PRIMARY_BLUE, 
    borderBottomLeftRadius: 45, 
    borderBottomRightRadius: 45, 
    overflow: 'hidden' 
  },
  headerGradient: { ...StyleSheet.absoluteFillObject },
  blob1: { position: 'absolute', top: -50, right: -50, width: 250, height: 250, borderRadius: 125, backgroundColor: '#1E293B', opacity: 0.2 },
  blob2: { position: 'absolute', bottom: -40, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: '#1655D9', opacity: 0.15 },
  headerContent: { paddingHorizontal: 25 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitleText: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  heroMain: { marginTop: 35, gap: 8 },
  heroTag: { fontSize: 11, fontWeight: '900', color: 'rgba(255,255,255,0.6)', letterSpacing: 2 },
  heroTitle: { fontSize: 32, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  scrollContent: { paddingBottom: 60 },
  mainContent: { paddingHorizontal: 25, marginTop: 25 },
  sectionTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 20, opacity: 0.6 },
  statementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 3,
  },
  cardInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconBox: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  textContainer: { flex: 1 },
  monthText: { fontSize: 16, fontWeight: '800' },
  periodText: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  amountText: { fontSize: 15, fontWeight: '900' },
  statusBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '900', color: '#16A34A', textTransform: 'uppercase' },
  downloadBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  infoBox: { flexDirection: 'row', padding: 20, gap: 12, alignItems: 'center', marginTop: 10 },
  infoText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 18 }
});
