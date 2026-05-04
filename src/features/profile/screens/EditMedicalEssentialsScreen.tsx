import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColor } from '@/shared/hooks/use-theme-color';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function EditMedicalEssentials() {
  const router = useRouter();
  const { t } = useTranslation();
  
  const [bloodGroup, setBloodGroup] = useState('');
  const [conditions, setConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [loading, setLoading] = useState(false);

  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');

  useEffect(() => {
    loadMedicalData();
  }, []);

  const loadMedicalData = async () => {
    try {
      const saved = await AsyncStorage.getItem('@medical_essentials');
      if (saved) {
        const parsed = JSON.parse(saved);
        setBloodGroup(parsed.bloodGroup || '');
        setConditions(parsed.conditions || '');
        setAllergies(parsed.allergies || '');
      }
    } catch (e) {
      console.error('Failed to load medical data', e);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const medicalData = { bloodGroup, conditions, allergies };
      await AsyncStorage.setItem('@medical_essentials', JSON.stringify(medicalData));
      Alert.alert(t('common.success'), 'Medical information updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert(t('common.error'), 'Failed to save medical data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar style="light" />
      
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
            <Text style={styles.headerTitle}>{t('emergency.medical_essentials_title')}</Text>
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={styles.formContainer}>
          <Text style={[styles.sectionDesc, { color: subtextColor }]}>
            Provide your vital medical details. This information can save lives during critical situations.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: subtextColor }]}>{t('emergency.blood_group_label')}</Text>
            <View style={styles.bloodGrid}>
              {BLOOD_GROUPS.map((bg) => (
                <TouchableOpacity 
                  key={bg} 
                  style={[
                    styles.bloodBadge, 
                    { backgroundColor: cardColor, borderColor: borderColor },
                    bloodGroup === bg && { backgroundColor: '#EF4444', borderColor: '#EF4444' }
                  ]}
                  onPress={() => setBloodGroup(bg)}
                >
                  <Text style={[styles.bloodText, { color: textColor }, bloodGroup === bg && { color: '#FFF' }]}>{bg}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: subtextColor }]}>{t('emergency.conditions_label')}</Text>
            <View style={[styles.inputWrapper, styles.textAreaWrapper, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <MaterialCommunityIcons name="heart-pulse" size={20} color={PRIMARY_BLUE} style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, styles.textArea, { color: textColor }]}
                placeholder="e.g. Diabetes, Asthma, None"
                placeholderTextColor={subtextColor}
                multiline
                numberOfLines={3}
                value={conditions}
                onChangeText={setConditions}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: subtextColor }]}>{t('emergency.allergies_label')}</Text>
            <View style={[styles.inputWrapper, styles.textAreaWrapper, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={PRIMARY_BLUE} style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, styles.textArea, { color: textColor }]}
                placeholder="e.g. Penicillin, Latex, None"
                placeholderTextColor={subtextColor}
                multiline
                numberOfLines={3}
                value={allergies}
                onChangeText={setAllergies}
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.saveBtn, loading && { opacity: 0.7 }]} 
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveBtnText}>{loading ? t('common.loading') : t('emergency.update_records')}</Text>
          </TouchableOpacity>
          
          <View style={styles.privacyNote}>
            <Ionicons name="shield-checkmark" size={16} color="#10B981" />
            <Text style={[styles.privacyText, { color: subtextColor }]}>
              This information is only visible to the safety team and medical professionals in emergencies.
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
  header: {
    height: 140,
    backgroundColor: PRIMARY_BLUE,
  },
  headerGradient: { ...StyleSheet.absoluteFillObject },
  headerContent: { paddingHorizontal: 25 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  scrollContent: { flexGrow: 1 },
  formContainer: { padding: 25 },
  sectionDesc: { fontSize: 14, fontWeight: '600', lineHeight: 22, marginBottom: 35 },
  inputGroup: { marginBottom: 30 },
  label: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 15 },
  bloodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bloodBadge: {
    width: (width - 86) / 4,
    height: 55,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bloodText: { fontSize: 16, fontWeight: '900' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 65,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
  },
  textAreaWrapper: {
    height: 100,
    alignItems: 'flex-start',
    paddingVertical: 15,
  },
  inputIcon: { marginRight: 15, marginTop: 2 },
  input: { flex: 1, fontSize: 16, fontWeight: '700' },
  textArea: { textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: PRIMARY_BLUE,
    height: 65,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: PRIMARY_BLUE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  privacyNote: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 25, paddingHorizontal: 10 },
  privacyText: { fontSize: 12, fontWeight: '600', lineHeight: 18, flex: 1 }
});
