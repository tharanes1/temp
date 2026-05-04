import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTourStore, TourStep } from '@/shared/store/tourStore';

export { TourStep };

const { width: W } = Dimensions.get('window');

// ─── Pulse Indicator ─────────────────────────────────────────────────────────

function PulseRing({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1600, useNativeDriver: true })
    ).start();
  }, []); // runs once, never restarts

  const cx = x + w / 2;
  const cy = y + h / 2;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill]}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: 'rgba(255,255,255,0.25)',
          top: cy - 32,
          left: cx - 32,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.6] }) }],
          opacity: anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.6, 0] }),
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: '#38BDF8',
          borderWidth: 2.5,
          borderColor: '#FFF',
          top: cy - 7,
          left: cx - 7,
        }}
      />
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AppTour() {
  const { visible, steps, stopTour } = useTourStore();
  const [stepIdx, setStepIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  // Animate card on step change — state updates first, animation follows
  useEffect(() => {
    if (!visible) { setStepIdx(0); return; }
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  }, [stepIdx, visible]);

  if (!visible) return null;

  const step: TourStep | undefined = steps[stepIdx];
  if (!step || !step.targetPos) return null;

  const { targetPos } = step;

  const handleNext = () => {
    if (stepIdx < steps.length - 1) {
      setStepIdx(prev => prev + 1); // instant — no animation blocking
    } else {
      stopTour();
    }
  };

  const handleBack = () => {
    if (stepIdx > 0) setStepIdx(prev => prev - 1);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.root}>
        {/* Dim overlay */}
        <View style={styles.overlay} />

        {/* Pulse on target — persistent instance, only position changes */}
        <PulseRing {...targetPos} />

        {/* Bottom card */}
        <Animated.View style={[styles.card, { paddingBottom: insets.bottom + 16, opacity: fadeAnim }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.row}>
            <View style={styles.iconBox}>
              {step.iconType === 'MaterialCommunityIcons' ? (
                <MaterialCommunityIcons name={step.icon as any} size={22} color="#1800ad" />
              ) : (
                <Ionicons name={step.icon as any} size={22} color="#1800ad" />
              )}
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.tag}>STEP {stepIdx + 1} OF {steps.length}</Text>
              <Text style={styles.title}>{step.title}</Text>
            </View>
            <TouchableOpacity onPress={stopTour} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <Text style={styles.desc}>{step.desc}</Text>

          {/* Footer */}
          <View style={styles.row}>
            <TouchableOpacity onPress={handleBack} disabled={stepIdx === 0} style={[styles.backBtn, stepIdx === 0 && { opacity: 0 }]}>
              <Text style={styles.backText}>Previous</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleNext} style={styles.nextBtn} activeOpacity={0.8}>
              <Text style={styles.nextText}>{stepIdx === steps.length - 1 ? 'Finish' : 'Next'}</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  card: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  titleBlock: { flex: 1 },
  tag: { fontSize: 10, fontWeight: '800', color: '#38BDF8', letterSpacing: 1.2, marginBottom: 2 },
  title: { fontSize: 19, fontWeight: '900', color: '#FFF' },
  desc: { fontSize: 14, color: '#CBD5E1', lineHeight: 22, marginVertical: 16, fontWeight: '500' },
  backBtn: { paddingVertical: 10 },
  backText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  nextBtn: { marginLeft: 'auto', backgroundColor: '#1800ad', paddingVertical: 13, paddingHorizontal: 24, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextText: { color: '#FFF', fontWeight: '900', fontSize: 15 },
});