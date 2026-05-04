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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColor } from '@/shared/hooks/use-theme-color';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

export default function EditEmergencyContact() {
  const router = useRouter();
  const { t } = useTranslation();
  
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');

  useEffect(() => {
    loadCurrentContact();
  }, []);

  const loadCurrentContact = async () => {
    try {
      const saved = await AsyncStorage.getItem('@emergency_contact');
      if (saved) {
        const parsed = JSON.parse(saved);
        setName(parsed.name || '');
        setRelation(parsed.relation || '');
        setPhone(parsed.phone || '');
      }
    } catch (e) {
      console.error('Failed to load contact', e);
    }
  };

  const handleSave = async () => {
    if (!name || !relation || !phone) {
      Alert.alert(t('common.error'), 'Please fill all fields');
      return;
    }

    if (phone.length < 10) {
      Alert.alert(t('common.error'), 'Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      const contactData = { name, relation, phone };
      await AsyncStorage.setItem('@emergency_contact', JSON.stringify(contactData));
      Alert.alert(t('common.success'), 'Emergency contact updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert(t('common.error'), 'Failed to save contact');
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
            <Text style={styles.headerTitle}>{t('emergency.edit_contact_title')}</Text>
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={styles.formContainer}>
          <Text style={[styles.sectionDesc, { color: subtextColor }]}>
            {t('emergency.safety_guidelines_sub', { defaultValue: 'Add a trusted contact who we can reach out to in case of any emergency during your missions.' })}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: subtextColor }]}>{t('kyc.full_name').toUpperCase()}</Text>
            <View style={[styles.inputWrapper, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <Ionicons name="person-outline" size={20} color={PRIMARY_BLUE} style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, { color: textColor }]}
                placeholder="Enter contact name"
                placeholderTextColor={subtextColor}
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: subtextColor }]}>{t('emergency.relation_label').toUpperCase()}</Text>
            <View style={[styles.inputWrapper, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <Ionicons name="people-outline" size={20} color={PRIMARY_BLUE} style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, { color: textColor }]}
                placeholder="e.g. Father, Spouse, Friend"
                placeholderTextColor={subtextColor}
                value={relation}
                onChangeText={setRelation}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: subtextColor }]}>{t('emergency.mobile_number').toUpperCase()}</Text>
            <View style={[styles.inputWrapper, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <Ionicons name="call-outline" size={20} color={PRIMARY_BLUE} style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, { color: textColor }]}
                placeholder="10-digit mobile number"
                placeholderTextColor={subtextColor}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.saveBtn, loading && { opacity: 0.7 }]} 
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveBtnText}>{loading ? t('common.loading') : t('emergency.save_contact')}</Text>
          </TouchableOpacity>
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
  inputGroup: { marginBottom: 25 },
  label: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 10 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 65,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
  },
  inputIcon: { marginRight: 15 },
  input: { flex: 1, fontSize: 16, fontWeight: '700' },
  saveBtn: {
    backgroundColor: PRIMARY_BLUE,
    height: 65,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: PRIMARY_BLUE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }
});
