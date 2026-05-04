import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert, Linking } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

export default function EmergencyContacts() {
  const router = useRouter();
  const { t } = useTranslation();
  const [contact, setContact] = useState<any>(null);
  const [medical, setMedical] = useState<any>(null);

  // Theme support
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const cardAltColor = useThemeColor({}, 'cardSecondary');
  const { darkMode } = useSettings();
  const isDark = darkMode;

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        const savedContact = await AsyncStorage.getItem('@emergency_contact');
        const savedMedical = await AsyncStorage.getItem('@medical_essentials');
        if (savedContact) setContact(JSON.parse(savedContact));
        if (savedMedical) setMedical(JSON.parse(savedMedical));
      };
      loadData();
    }, [])
  );

  const handleSOSCall = (type: string) => {
    Alert.alert(
      t('emergency.sos_confirm_title'),
      t('emergency.sos_confirm_msg', { type }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('emergency.call_now'),
          onPress: async () => {
            // Closes review §6.3 #22 — SOS handler was previously a console.log only.
            try {
              const { emergencyService } = await import('@/services/api/features/emergency');
              const { useLocation } = await import('@/features/map/hooks/useLocation');
              // Resolve current coords; fall back to (0,0) if location is unavailable
              // (the alert's banner copy reassures the rider regardless).
              const ctx = (useLocation as unknown as () => { location: { latitude: number; longitude: number } | null }).call(null);
              const lat = ctx?.location?.latitude ?? 0;
              const lng = ctx?.location?.longitude ?? 0;
              const sosType: 'accident' | 'medical' | 'safety' | 'other' =
                type.toLowerCase() === 'ambulance' || type.toLowerCase() === 'medical'
                  ? 'medical'
                  : type.toLowerCase() === 'police'
                  ? 'safety'
                  : 'other';
              await emergencyService.triggerSos({ latitude: lat, longitude: lng, type: sosType });
              Alert.alert(t('emergency.sos_confirm_title'), 'Ops alerted. Help is on the way.');
            } catch (e) {
              if (__DEV__) console.warn('SOS trigger failed:', (e as Error).message);
            }
            // Also dial the relevant emergency number locally — server-side notify
            // is async, but the rider gets immediate dial-tone access.
            const tel = type.toLowerCase() === 'police' ? 'tel:100' : type.toLowerCase() === 'ambulance' ? 'tel:108' : 'tel:112';
            await Linking.openURL(tel).catch(() => {});
          },
        },
      ],
    );
  };

  const handleWhatsAppSupport = () => {
    const phoneNumber = '+919876543210'; 
    const message = encodeURIComponent('Emergency Support: I need assistance with my current delivery mission.');
    const url = `whatsapp://send?phone=${phoneNumber}&text=${message}`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://wa.me/${phoneNumber}?text=${message}`);
      }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      
      {/* 🔴 PREMIUM HEADER */}
      <View style={styles.header}>
        <LinearGradient
          colors={['#1800ad', '#2563EB']}
          style={styles.headerGradient}
        />
        <SafeAreaView edges={['top']} style={styles.headerContent}>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('emergency.title')}</Text>
            <View style={styles.placeholder} />
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mainContent}>
          
          <Text style={[styles.sectionLabel, { color: subtextColor }]}>{t('emergency.sos_quick_actions')}</Text>
          <View style={styles.sosGrid}>
            <TouchableOpacity style={[styles.sosBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleSOSCall('Police')}>
              <Ionicons name="shield-outline" size={28} color="#FFF" />
              <Text style={styles.sosText}>{t('emergency.police')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sosBtn, { backgroundColor: '#F59E0B' }]} onPress={() => handleSOSCall('Ambulance')}>
              <Ionicons name="medical-outline" size={28} color="#FFF" />
              <Text style={styles.sosText}>{t('emergency.ambulance')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sosBtn, { backgroundColor: '#25D366' }]} onPress={handleWhatsAppSupport}>
              <Ionicons name="logo-whatsapp" size={28} color="#FFF" />
              <Text style={styles.sosText}>WHATSAPP</Text>
            </TouchableOpacity>
          </View>

          {/* 🟢 WHATSAPP EMERGENCY CARD */}
          <TouchableOpacity 
            activeOpacity={0.8}
            style={[styles.whatsappCard, { backgroundColor: '#E8F5E9', borderColor: '#25D366' }]} 
            onPress={handleWhatsAppSupport}
          >
            <View style={styles.waIconBox}>
              <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
            </View>
            <View style={styles.waContent}>
              <Text style={styles.waTitle}>Safety Chat Support</Text>
              <Text style={styles.waSub}>Report safety concerns instantly via WhatsApp</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#25D366" />
          </TouchableOpacity>

          <View style={[styles.infoCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
             <View style={styles.cardHeader}>
               <Text style={[styles.cardTitle, { color: subtextColor }]}>{t('emergency.primary_contact_section')}</Text>
               <TouchableOpacity onPress={() => router.push('/edit-emergency-contact')}>
                  <Text style={styles.editLink}>{t('emergency.edit')}</Text>
               </TouchableOpacity>
             </View>
             
             <View style={styles.contactRow}>
                <View style={[styles.avatarHole, { backgroundColor: cardAltColor }]}>
                   <Ionicons name="person-outline" size={24} color={PRIMARY_BLUE} />
                </View>
                <View>
                   <Text style={[styles.contactName, { color: textColor }]}>{contact ? contact.name : t('emergency.none_added')}</Text>
                   <Text style={[styles.contactRelation, { color: subtextColor }]}>{contact ? contact.relation : t('emergency.relation_label')}</Text>
                </View>
             </View>

             <View style={styles.divider} />

             <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: subtextColor }]}>{t('emergency.mobile_number')}</Text>
                <Text style={[styles.detailValue, { color: textColor }]}>{contact ? contact.phone : t('emergency.not_provided')}</Text>
             </View>
          </View>

          <View style={[styles.infoCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
             <View style={styles.cardHeader}>
               <Text style={[styles.cardTitle, { color: subtextColor, marginBottom: 0 }]}>{t('emergency.medical_essentials')}</Text>
               <TouchableOpacity onPress={() => router.push('/edit-medical-essentials')}>
                  <Text style={styles.editLink}>{t('emergency.edit')}</Text>
               </TouchableOpacity>
             </View>
             
             <View style={styles.medRow}>
                <View style={styles.medItem}>
                   <Text style={[styles.medLabel, { color: subtextColor }]}>{t('emergency.blood_group')}</Text>
                   <Text style={[styles.medValue, { color: '#EF4444' }]}>{medical ? medical.bloodGroup : t('emergency.not_set')}</Text>
                </View>
                <View style={styles.medItem}>
                   <Text style={[styles.medLabel, { color: subtextColor }]}>{t('emergency.medical_conditions')}</Text>
                   <Text style={[styles.medValue, { color: textColor }]}>{medical ? (medical.conditions || 'None') : t('emergency.none_reported')}</Text>
                </View>
             </View>
          </View>

          <View style={[styles.guidelinesBox, { backgroundColor: cardAltColor }]}>
             <Text style={[styles.guideTitle, { color: textColor }]}>{t('emergency.safety_guidelines')}</Text>
             <Guideline text={t('emergency.guideline_1')} color={subtextColor} />
             <Guideline text={t('emergency.guideline_2')} color={subtextColor} />
             <Guideline text={t('emergency.guideline_3')} color={subtextColor} />
          </View>
        </View>
      </ScrollView>
          </View>
  );
}

function Guideline({ text, color }: { text: string, color: string }) {
  return (
    <View style={styles.guideItem}>
      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
      <Text style={[styles.guideText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 140,
    backgroundColor: '#1800ad',
    zIndex: 100,
    elevation: 5,
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
  },
  placeholder: {
    width: 44,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  mainContent: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 15,
    marginLeft: 5,
  },
  sosGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  sosBtn: {
    flex: 1,
    height: 100,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  sosText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  infoCard: {
    borderRadius: 25,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  editLink: {
    fontSize: 12,
    fontWeight: '900',
    color: PRIMARY_BLUE,
    letterSpacing: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  avatarHole: {
    width: 54,
    height: 54,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactName: {
    fontSize: 18,
    fontWeight: '900',
  },
  contactRelation: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 20,
  },
  detailRow: {
    gap: 5,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  medRow: {
    flexDirection: 'row',
    gap: 20,
  },
  medItem: {
    flex: 1,
    gap: 8,
  },
  medLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  medValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  guidelinesBox: {
    borderRadius: 25,
    padding: 24,
    marginTop: 10,
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 20,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 15,
  },
  guideText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  whatsappCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 25,
    borderWidth: 1,
    marginBottom: 20,
    gap: 15,
  },
  waIconBox: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waContent: {
    flex: 1,
  },
  waTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#064E3B',
  },
  waSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
    marginTop: 2,
  }
});
