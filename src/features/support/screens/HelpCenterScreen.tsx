import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions,
  Linking,
  Image
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useThemeColor } from '@/shared/hooks/use-theme-color';
import { useSettings } from '@/core/providers/SettingsContext';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = '#1800ad';

export default function HelpCenter() {
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
  const [activeCategory, setActiveCategory] = useState('orders');

  // Theme support
  const bgColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const subtextColor = useThemeColor({}, 'subtext');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const cardAltColor = useThemeColor({}, 'cardSecondary');
  const { darkMode } = useSettings();
  const isDark = darkMode;

  const categories = [
    { id: 'orders', label: t('help.categories.missions'), icon: 'package-variant-closed' },
    { id: 'payment', label: t('help.categories.payouts'), icon: 'wallet-outline' },
    { id: 'account', label: t('help.categories.account'), icon: 'account-cog-outline' },
    { id: 'safety', label: t('help.categories.safety'), icon: 'shield-check-outline' },
  ];

  // Server-driven FAQs.  i18n bundle stays as the offline cold-start fallback
  // (used until the API resolves).  Once the API responds, the projection
  // below replaces the fallback so the rendered list always reflects the
  // admin-edited content.
  const fallbackFaqs = React.useMemo(
    () => [
      { cat: 'orders', q: t('help.faqs.q1'), a: t('help.faqs.a1') },
      { cat: 'orders', q: t('help.faqs.q2'), a: t('help.faqs.a2') },
      { cat: 'payment', q: t('help.faqs.q3'), a: t('help.faqs.a3') },
      { cat: 'payment', q: t('help.faqs.q4'), a: t('help.faqs.a4') },
      { cat: 'account', q: t('help.faqs.q5'), a: t('help.faqs.a5') },
      { cat: 'safety', q: t('help.faqs.q6'), a: t('help.faqs.a6') },
    ],
    [t],
  );

  const [faqs, setFaqs] = React.useState<{ cat: string; q: string; a: string }[]>(fallbackFaqs);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { supportService } = await import('@/services/api/features/support');
        const list = await supportService.listFaq('all');
        if (cancelled || list.length === 0) return;
        setFaqs(list.map((e) => ({ cat: e.category, q: e.question, a: e.answer })));
      } catch (e) {
        if (__DEV__) console.warn('FAQ fetch failed:', (e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentFaqs = faqs.filter((f) => f.cat === activeCategory);

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      
      {/* 🔴 PREMIUM HELP HEADER */}
      <View style={styles.header}>
        <LinearGradient
          colors={[PRIMARY_BLUE, '#2563EB']}
          style={styles.headerGradient}
        />
        <SafeAreaView edges={['top']} style={styles.headerContent}>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('help.title')}</Text>
            <View style={styles.placeholder} />
          </View>
          
          <View style={styles.searchBar}>
             <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" />
             <Text style={styles.searchText}>{t('help.search_placeholder')}</Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mainContent}>
          
          {/* CATEGORY SELECTOR */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.catInner}>
            {categories.map(cat => (
              <TouchableOpacity 
                key={cat.id} 
                style={[styles.catBadge, activeCategory === cat.id ? styles.catBadgeActive : { backgroundColor: cardColor, borderColor: borderColor }]}
                onPress={() => setActiveCategory(cat.id)}
              >
                <MaterialCommunityIcons 
                  name={cat.icon as any} 
                  size={18} 
                  color={activeCategory === cat.id ? '#FFF' : subtextColor} 
                />
                <Text style={[styles.catText, activeCategory === cat.id ? styles.catTextActive : { color: subtextColor }]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* FAQ LIST */}
          <Text style={[styles.sectionLabel, { color: subtextColor }]}>{t('help.section_faq')}</Text>
          {currentFaqs.map((faq, idx) => (
             <View key={idx} style={[styles.faqCard, { backgroundColor: cardColor, borderColor: borderColor, borderWidth: isDark ? 1 : 0 }]}>
                <Text style={[styles.faqQ, { color: textColor }]}>{faq.q}</Text>
                <Text style={[styles.faqA, { color: subtextColor }]}>{faq.a}</Text>
             </View>
          ))}

          {/* CONTACT OPTIONS */}
          <Text style={[styles.sectionLabel, { color: subtextColor }]}>{t('help.section_help')}</Text>
          <View style={[styles.contactCard, { backgroundColor: cardColor, borderColor: borderColor, borderWidth: isDark ? 1 : 0 }]}>
             <TouchableOpacity style={[styles.contactItem, { borderBottomColor: borderColor }]} onPress={() => Linking.openURL('tel:1800CRAVIX')}>
                <View style={[styles.iconBox, { backgroundColor: isDark ? '#1e1b4b' : '#EEF2FF' }]}>
                   <Ionicons name="call" size={24} color={PRIMARY_BLUE} />
                </View>
                <View style={styles.contactInfo}>
                   <Text style={[styles.contactTitle, { color: textColor }]}>{t('help.emergency_hotline')}</Text>
                   <Text style={[styles.contactSub, { color: subtextColor }]}>{t('help.hotline_sub')}</Text>
                </View>
             </TouchableOpacity>

             <TouchableOpacity 
               style={[styles.contactItem, { borderBottomColor: borderColor }]} 
               onPress={() => {
                 const phoneNumber = '+919876543210';
                 const message = encodeURIComponent('Support Request: I need help with my Cravix account.');
                 Linking.openURL(`https://wa.me/${phoneNumber}?text=${message}`);
               }}
             >
                <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                   <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                </View>
                <View style={styles.contactInfo}>
                   <Text style={[styles.contactTitle, { color: textColor }]}>{t('help.whatsapp_support')}</Text>
                   <Text style={[styles.contactSub, { color: subtextColor }]}>{t('emergency.chat_sub', { defaultValue: 'Instant support via WhatsApp' })}</Text>
                </View>
             </TouchableOpacity>

             <TouchableOpacity style={[styles.contactItem, { borderBottomWidth: 0 }]} onPress={() => Linking.openURL('mailto:support@cravix.com')}>
                <View style={[styles.iconBox, { backgroundColor: isDark ? '#064e3b' : '#ECFDF4' }]}>
                   <Ionicons name="mail" size={24} color="#10B981" />
                </View>
                <View style={styles.contactInfo}>
                   <Text style={[styles.contactTitle, { color: textColor }]}>{t('help.email_ticket')}</Text>
                   <Text style={[styles.contactSub, { color: subtextColor }]}>{t('help.email_sub')}</Text>
                </View>
             </TouchableOpacity>
          </View>

          {/* SELF-HELP GUIDES */}
          <Text style={[styles.sectionLabel, { color: subtextColor, marginTop: 30 }]}>{t('help.guides_section')}</Text>
          <TouchableOpacity 
            style={[styles.guidePromo, { backgroundColor: PRIMARY_BLUE }]}
            onPress={() => router.push('/app-guide')}
          >
            <View style={styles.guidePromoText}>
              <Text style={styles.guidePromoTitle}>New to Cravix?</Text>
              <Text style={styles.guidePromoSub}>Interactive walkthroughs for all app features</Text>
            </View>
            <View style={styles.guidePromoIcon}>
              <Ionicons name="play-circle" size={32} color="#FFF" />
            </View>
          </TouchableOpacity>

        </View>
      </ScrollView>

          </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 200, backgroundColor: PRIMARY_BLUE, zIndex: 100, elevation: 5 },
  headerGradient: { ...StyleSheet.absoluteFillObject },
  headerContent: { flex: 1, paddingHorizontal: 20 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  placeholder: { width: 44 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 18, marginTop: 25, gap: 12 },
  searchText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
  scrollContent: { paddingBottom: 40 },
  mainContent: { paddingHorizontal: 20, marginTop: 25 },
  categoryScroll: { marginBottom: 25 },
  catInner: { gap: 10, paddingRight: 20 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 15, borderWidth: 1 },
  catBadgeActive: { backgroundColor: PRIMARY_BLUE, borderColor: PRIMARY_BLUE },
  catText: { fontSize: 11, fontWeight: '900' },
  catTextActive: { color: '#FFF' },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 15, marginLeft: 5 },
  faqCard: { borderRadius: 25, padding: 25, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  faqQ: { fontSize: 16, fontWeight: '900', marginBottom: 10 },
  faqA: { fontSize: 14, lineHeight: 22, fontWeight: '600' },
  contactCard: { borderRadius: 25, overflow: 'hidden', elevation: 5 },
  contactItem: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  iconBox: { width: 50, height: 50, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  contactInfo: { flex: 1, marginLeft: 15 },
  contactTitle: { fontSize: 15, fontWeight: '800' },
  contactSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  guidePromo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    borderRadius: 25,
    marginTop: 10,
    shadowColor: PRIMARY_BLUE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  guidePromoText: {
    flex: 1,
  },
  guidePromoTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
  },
  guidePromoSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    fontWeight: '600',
  },
  guidePromoIcon: {
    marginLeft: 15,
  },
  decorImg: {
    width: '100%',
    height: '100%',
  },
});
