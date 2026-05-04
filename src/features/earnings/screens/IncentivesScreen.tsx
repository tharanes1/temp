import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MILESTONES, SURGE_DATA } from '@/core/config/incentives';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useTranslation } from 'react-i18next';

const PRIMARY_BLUE = '#1800ad';

export default function IncentivesScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.back();
        return true;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );

      return () => subscription.remove();
    }, [router])
  );

  // Theme support
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const cardAltColor = useThemeColor({}, 'cardSecondary');
  
  const { darkMode } = useSettings();
  const isDark = darkMode;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={[PRIMARY_BLUE, '#2563EB']} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('incentives.title')}</Text>
          <View style={styles.potentialBox}>
             <Text style={styles.potentialLabel}>{t('incentives.potential_label')}</Text>
             <Text style={styles.potentialValue}>₹200.00</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>{t('incentives.ongoing_milestones')}</Text>
        </View>

        {MILESTONES.map((milestone: any) => (
          <View key={milestone.id} style={[styles.milestoneCard, { backgroundColor: cardColor, borderColor: borderColor, borderWidth: isDark ? 1 : 0 }]}>
            <View style={[styles.milestoneIconBox, { backgroundColor: isDark ? '#1e1b4b' : '#EEF2FF' }]}>
              <Ionicons name="trophy" size={24} color={isDark ? '#818cf8' : PRIMARY_BLUE} />
            </View>
            <View style={styles.milestoneInfo}>
               <View style={styles.milestoneHeader}>
                  <Text style={[styles.milestoneTitle, { color: textColor }]}>{milestone.title}</Text>
                  <Text style={styles.milestoneReward}>₹{milestone.reward}</Text>
               </View>
               <Text style={[styles.milestoneSub, { color: subtextColor }]}>Complete {milestone.target} orders</Text>
               
               <View style={styles.progressContainer}>
                  <View style={[styles.progressBarBg, { backgroundColor: cardAltColor }]}>
                     <View style={[styles.progressBarFill, { width: `${(milestone.progress / milestone.target) * 100}%` }]} />
                  </View>
                  <Text style={[styles.progressText, { color: subtextColor }]}>{milestone.progress} / {milestone.target} {t('common.completed')}</Text>
               </View>
            </View>
          </View>
        ))}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>{t('incentives.surge_schedule')}</Text>
        </View>

        {SURGE_DATA.map((surge: any, index: number) => (
          <View key={index} style={[styles.surgeCard, { backgroundColor: cardColor, borderColor: isDark ? borderColor : PRIMARY_BLUE, borderLeftWidth: 4 }]}>
             <View style={styles.surgeTimeBox}>
                <Ionicons name="time-outline" size={18} color={subtextColor} />
                <Text style={[styles.surgeTime, { color: textColor }]}>{surge.zone}</Text>
             </View>
             <View style={styles.surgeMultiplier}>
                <Text style={[styles.multiplierText, { color: isDark ? '#818cf8' : PRIMARY_BLUE }]}>{surge.multiplier}x</Text>
                <Text style={[styles.surgeLabel, { color: subtextColor }]}>{surge.active ? 'ACTIVE' : 'UPCOMING'}</Text>
             </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 220, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
  headerContent: { paddingHorizontal: 25 },
  backBtn: { paddingVertical: 15 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#FFF', marginTop: 5 },
  potentialBox: { marginTop: 25, backgroundColor: 'rgba(255,255,255,0.15)', padding: 15, borderRadius: 15 },
  potentialLabel: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5 },
  potentialValue: { fontSize: 28, fontWeight: '900', color: '#FFF', marginTop: 2 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 25, paddingBottom: 40 },
  sectionHeader: { marginBottom: 15, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  milestoneCard: { flexDirection: 'row', borderRadius: 22, padding: 18, marginBottom: 15, borderWidth: 1 },
  milestoneIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  milestoneInfo: { flex: 1 },
  milestoneHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  milestoneTitle: { fontSize: 15, fontWeight: '800', flex: 1, marginRight: 10 },
  milestoneReward: { fontSize: 14, fontWeight: '900', color: '#16A34A' },
  milestoneSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  progressContainer: { marginTop: 15 },
  progressBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: PRIMARY_BLUE, borderRadius: 4 },
  progressText: { fontSize: 10, fontWeight: '800', marginTop: 8 },
  surgeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 18, padding: 18, marginBottom: 12 },
  surgeTimeBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  surgeTime: { fontSize: 14, fontWeight: '700' },
  surgeMultiplier: { alignItems: 'flex-end' },
  multiplierText: { fontSize: 16, fontWeight: '900' },
  surgeLabel: { fontSize: 10, fontWeight: '800', marginTop: 2 },
});
