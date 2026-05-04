import React, { useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, BackHandler } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { DemandHeatmap, DemandHeatmapRef } from '@/features/home/components/DemandHeatmap';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { useTranslation } from 'react-i18next';

export default function HeatmapFullScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const mapRef = useRef<DemandHeatmapRef>(null);

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
  const PRIMARY_BLUE = '#1800ad';
  
  const { darkMode } = useSettings();
  const isDark = darkMode;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      
      {/* FULL SCREEN MAP */}
      <View style={styles.mapContainer}>
         <DemandHeatmap ref={mapRef} isFullScreen={true} />
      </View>

      {/* FLOATING HEADER */}
      <View style={styles.headerWrapper}>
        <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={styles.headerBlur}>
          <SafeAreaView edges={['top']} style={styles.headerContent}>
             <TouchableOpacity style={[styles.backBtn, { backgroundColor: cardColor }]} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color={isDark ? "#FFF" : "#1E293B"} />
             </TouchableOpacity>
             <View style={styles.titleBox}>
                <Text style={[styles.headerTitle, { color: textColor }]}>{t('heatmap.title')}</Text>
                <View style={styles.liveTag}>
                   <View style={styles.liveDot} />
                   <Text style={styles.liveText}>{t('common.live')}</Text>
                </View>
             </View>
             <View style={styles.placeholder} />
          </SafeAreaView>
        </BlurView>
      </View>

      {/* LOCATE ME BUTTON */}
      <View style={styles.locateWrapper}>
         <TouchableOpacity 
           style={[styles.locateBtn, { backgroundColor: cardColor }]} 
           onPress={() => mapRef.current?.locateUser()}
         >
            <Ionicons name="locate" size={26} color={PRIMARY_BLUE} />
         </TouchableOpacity>
      </View>

      {/* OVERLAY INSIGHT CARD */}
      <View style={styles.insightWrapper}>
         <View style={[styles.insightCard, { backgroundColor: cardColor, borderColor: borderColor, borderWidth: isDark ? 1 : 0 }]}>
            <MaterialCommunityIcons name="lightning-bolt" size={24} color="#F59E0B" />
            <View style={styles.insightTextStack}>
               <Text style={[styles.insightTitle, { color: textColor }]}>{t('heatmap.insight_title')}</Text>
               <Text style={[styles.insightSub, { color: subtextColor }]}>{t('heatmap.insight_sub')}</Text>
            </View>
         </View>
      </View>
          </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerBlur: {
    paddingBottom: 15,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  titleBox: {
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  placeholder: {
    width: 44,
  },
  locateWrapper: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    zIndex: 10,
  },
  locateBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  insightWrapper: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  insightCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  insightTextStack: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  insightSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
