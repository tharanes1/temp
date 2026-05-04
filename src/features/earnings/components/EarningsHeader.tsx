import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@/shared/theme';
import { ms, vs } from '@/shared/utils/responsive';
import { useWalletBalance } from '@/features/wallet/hooks/useWallet';

interface EarningsHeaderProps {
  onMeasureWallet: (event: any) => void;
  walletRef: React.RefObject<View | null>;
}

const formatINR = (n: number): string => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const EarningsHeader = ({ onMeasureWallet, walletRef }: EarningsHeaderProps) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { balance } = useWalletBalance();
  const available = balance?.availableForWithdrawal ?? 0;
  const pending = balance?.pendingSettlement ?? 0;

  return (
    <View style={styles.headerHero}>
      <LinearGradient
        colors={['#1800ad', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      />
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <SafeAreaView edges={['top']} style={styles.headerContent}>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.replace('/(tabs)')}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.partnerTag}>{t('earnings.financial_center')}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.heroMain}>
          <View 
            style={styles.walletCard} 
            ref={walletRef}
            onLayout={onMeasureWallet}
          >
            <View style={styles.walletHeader}>
              <View style={styles.walletInfo}>
                <Text style={styles.walletLabel}>{t('earnings.available_settlement')}</Text>
                <Text style={styles.walletBalance}>{formatINR(available)}</Text>
              </View>
              <TouchableOpacity 
                style={styles.walletActionBtn}
                onPress={() => router.push('/cashinhand')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FFF', '#F8FAFC']}
                  style={styles.walletActionGrad}
                >
                  <MaterialCommunityIcons name="wallet-plus" size={20} color={COLORS.primary} />
                  <Text style={styles.walletActionText}>{t('earnings.withdraw')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            
            <View style={styles.walletFooter}>
              <View style={styles.pendingIndicator}>
                <View style={styles.pulseDot} />
                <Text style={pendingLabelStyle}>+{formatINR(pending)} {t('earnings.pending')}</Text>
              </View>
              <TouchableOpacity style={styles.historyLink} onPress={() => router.push('/statements')}>
                <Text style={historyLinkTextStyle}>{t('profile.statements')}</Text>
                <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const pendingLabelStyle = {
  ...TYPOGRAPHY.tag,
  color: 'rgba(255,255,255,0.8)',
  fontSize: 10,
};

const historyLinkTextStyle = {
  ...TYPOGRAPHY.tag,
  color: 'rgba(255,255,255,0.6)',
  fontSize: 10,
};

const styles = StyleSheet.create({
  headerHero: { 
    backgroundColor: COLORS.primary, 
    borderBottomLeftRadius: ms(45), 
    borderBottomRightRadius: ms(45), 
    overflow: 'hidden',
    paddingBottom: vs(30),
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  blob1: {
    position: 'absolute',
    top: -ms(40),
    right: -ms(30),
    width: ms(160),
    height: ms(160),
    borderRadius: ms(80),
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  blob2: {
    position: 'absolute',
    bottom: -ms(20),
    left: -ms(40),
    width: ms(120),
    height: ms(120),
    borderRadius: ms(60),
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerContent: {
    paddingHorizontal: SPACING.l,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: vs(15),
  },
  iconBtn: {
    width: ms(44),
    height: ms(44),
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  partnerTag: {
    ...TYPOGRAPHY.tag,
    color: '#FFF',
    opacity: 0.8,
  },
  heroMain: {
    marginTop: vs(25),
    paddingHorizontal: 0,
  },
  walletCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.xl,
    padding: SPACING.l,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.l,
  },
  walletInfo: {
    flex: 1,
  },
  walletLabel: {
    ...TYPOGRAPHY.tag,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  walletBalance: {
    ...TYPOGRAPHY.hero,
    color: '#FFF',
    fontSize: ms(28),
    marginTop: 4,
  },
  walletActionBtn: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.medium,
    marginLeft: 'auto',
  },
  walletActionGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  walletActionText: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.primary,
    fontWeight: '900',
  },
  walletFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  pendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
