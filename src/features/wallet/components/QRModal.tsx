import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Dimensions, 
  Image, 
  ActivityIndicator,
  Alert,
  TextInput,
  Animated,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  BackHandler,
  Keyboard
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SHADOWS, RADIUS, SPACING } from '@/shared/theme';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  initialMode: 'scan' | 'receive';
  onClose: () => void;
  onSuccess: (amount: number) => void;
  riderId: string;
}

type ModalState = 'idle' | 'processing' | 'success' | 'error';

export default function QRModal({ visible, initialMode, onClose, onSuccess, riderId }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'scan' | 'receive'>(initialMode);
  const [status, setStatus] = useState<ModalState>('idle');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [merchantName, setMerchantName] = useState('');

  // Animations
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMode(initialMode);
      setStatus('idle');
      setAmount('');
      setNote('');
      
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true })
      ]).start();

      if (mode === 'scan') startScanLine();
    } else {
      scaleAnim.setValue(0.9);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    const onBackPress = () => {
      if (visible) {
        onClose();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [visible, onClose]);

  useEffect(() => {
    if (mode === 'scan' && status === 'idle') startScanLine();
  }, [mode, status]);

  const startScanLine = () => {
    scanLineAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  };

  const handleScan = ({ data }: { data: string }) => {
    if (status !== 'idle') return;
    
    setStatus('processing');
    // Simulate API Validation
    setTimeout(() => {
      const isSuccess = Math.random() > 0.1;
      if (isSuccess) {
        setMerchantName("Premium Restaurant Hub");
        setStatus('success');
        setTimeout(() => {
          onSuccess(450); // Simulation
          onClose();
        }, 2000);
      } else {
        setStatus('error');
      }
    }, 1500);
  };

  const qrUrl = useMemo(() => {
    const data = `cravix_pay:${riderId}?amt=${amount}&note=${encodeURIComponent(note)}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(data)}&color=1800ad&bgcolor=ffffff`;
  }, [riderId, amount, note]);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
        <Ionicons name="close" size={24} color="#FFF" />
      </TouchableOpacity>
      
      <View style={styles.titleGroup}>
        <Text style={styles.headerTitle}>{mode === 'scan' ? 'Pay Merchant' : 'Receive Payment'}</Text>
        <Text style={styles.headerSub}>{mode === 'scan' ? 'Scan QR to proceed' : 'Show this QR to merchant'}</Text>
      </View>

      <TouchableOpacity 
        style={styles.switchBtn} 
        onPress={() => setMode(m => m === 'scan' ? 'receive' : 'scan')}
      >
        <MaterialCommunityIcons name={mode === 'scan' ? 'qrcode' : 'camera'} size={20} color="#1800ad" />
        <Text style={styles.switchText}>{mode === 'scan' ? 'My QR' : 'Scan'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStatus = () => {
    if (status === 'processing') return (
      <View style={styles.statusOverlay}>
        <ActivityIndicator size="large" color="#FFF" />
        <Text style={styles.statusText}>Processing Payment...</Text>
      </View>
    );
    if (status === 'success') return (
      <View style={styles.statusOverlay}>
        <View style={styles.successCircle}>
           <Ionicons name="checkmark" size={60} color="#4ADE80" />
        </View>
        <Text style={styles.statusText}>Payment Successful</Text>
        <Text style={styles.merchantText}>Paid to {merchantName}</Text>
      </View>
    );
    if (status === 'error') return (
      <View style={styles.statusOverlay}>
        <View style={styles.errorCircle}>
           <Ionicons name="alert-circle" size={60} color="#EF4444" />
        </View>
        <Text style={styles.statusText}>Payment Failed</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => setStatus('idle')}>
           <Text style={styles.retryText}>RETRY SCAN</Text>
        </TouchableOpacity>
      </View>
    );
    return null;
  };

  return (
    <Modal visible={visible} animationType="none" transparent>
      <BlurView intensity={90} style={styles.overlay} tint="dark">
        <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
        <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <SafeAreaView style={{ flex: 1 }}>
            {renderHeader()}

            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
              style={styles.flex1}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <Pressable style={styles.flex1} onPress={Keyboard.dismiss}>
                <View style={styles.main}>
                  {mode === 'scan' ? (
                    <View style={styles.scannerBox}>
                      <CameraView
                        style={styles.camera}
                        onBarcodeScanned={status === 'idle' ? handleScan : undefined}
                        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                      >
                        <View style={styles.cameraOverlay}>
                          <View style={styles.dimRegion} />
                          <View style={styles.scanRegion}>
                             <View style={styles.dimRegion} />
                             <View style={styles.qrFrame}>
                                <View style={[styles.corner, styles.tl]} />
                                <View style={[styles.corner, styles.tr]} />
                                <View style={[styles.corner, styles.bl]} />
                                <View style={[styles.corner, styles.br]} />
                                <Animated.View style={[styles.scanLine, { 
                                  transform: [{ translateY: scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 240] }) }] 
                                }]} />
                             </View>
                             <View style={styles.dimRegion} />
                          </View>
                          <View style={styles.dimRegion}>
                             <Text style={styles.instructionText}>Align QR within frame</Text>
                          </View>
                        </View>
                        {renderStatus()}
                      </CameraView>
                    </View>
                  ) : (
                    <View style={styles.receiveBox}>
                      <View style={styles.qrCard}>
                         <View style={styles.qrHeaderRow}>
                            <MaterialCommunityIcons name="shield-check" size={16} color="#1800ad" />
                            <Text style={styles.qrHeaderLabel}>ENCRYPTED TRANSACTION</Text>
                         </View>
                         
                         <View style={styles.qrContainer}>
                            <Image 
                              key={qrUrl} // Force re-render when URL changes
                              source={{ uri: qrUrl }} 
                              style={styles.qrImage} 
                              resizeMode="contain"
                            />
                            <View style={styles.qrCenterLogo}>
                               <MaterialCommunityIcons name="integrated-circuit-chip" size={18} color="#1800ad" />
                            </View>
                         </View>

                         <View style={styles.inputs}>
                            <View style={styles.inputGroup}>
                               <Text style={styles.inputLabel}>AMOUNT (OPTIONAL)</Text>
                               <TextInput 
                                  style={styles.input} 
                                  placeholder="₹ 0.00" 
                                  keyboardType="decimal-pad"
                                  value={amount}
                                  onChangeText={setAmount}
                               />
                            </View>
                            <View style={styles.inputGroup}>
                               <Text style={styles.inputLabel}>NOTE</Text>
                               <TextInput 
                                  style={styles.input} 
                                  placeholder="Add settlement note" 
                                  value={note}
                                  onChangeText={setNote}
                                  maxLength={30}
                               />
                            </View>
                         </View>
                         
                         <Text style={styles.riderInfo}>Rider ID: {riderId}</Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.footer}>
                   <View style={styles.securityRow}>
                      <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.4)" />
                      <Text style={styles.securityLabel}>BANK-GRADE ENCRYPTION • SECURE PAY</Text>
                   </View>
                </View>
              </Pressable>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Animated.View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  overlay: { flex: 1 },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: 'rgba(0,0,0,0.5)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  titleGroup: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  headerSub: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  switchBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  switchText: { fontSize: 11, fontWeight: '900', color: '#1800ad' },
  
  main: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  scannerBox: { width: width - 40, height: height * 0.6, borderRadius: 30, overflow: 'hidden', backgroundColor: '#000', ...SHADOWS.medium },
  camera: { flex: 1 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject },
  dimRegion: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  scanRegion: { flexDirection: 'row', height: 260 },
  qrFrame: { width: 260, height: 260, position: 'relative' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: '#FFF', borderWidth: 5, borderRadius: 10 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { position: 'absolute', left: 10, right: 10, height: 3, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 2 },
  instructionText: { color: '#FFF', fontSize: 14, fontWeight: '800', marginTop: 20, opacity: 0.8 },

  statusOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  statusText: { color: '#FFF', fontSize: 18, fontWeight: '900', marginTop: 20 },
  successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(74,222,128,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#4ADE80' },
  errorCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(239,68,68,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#EF4444' },
  merchantText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700', marginTop: 10 },
  retryBtn: { marginTop: 30, backgroundColor: '#FFF', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 15 },
  retryText: { color: '#EF4444', fontWeight: '900', fontSize: 12 },

  receiveBox: { width: width - 40 },
  qrCard: { backgroundColor: '#FFF', borderRadius: 35, padding: 30, alignItems: 'center', ...SHADOWS.medium },
  qrHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 25 },
  qrHeaderLabel: { fontSize: 10, fontWeight: '900', color: '#1800ad', letterSpacing: 1 },
  qrContainer: { padding: 15, backgroundColor: '#FFF', borderRadius: 25, borderWidth: 1, borderColor: '#F1F5F9', ...SHADOWS.soft, position: 'relative' },
  qrImage: { width: 220, height: 220 },
  qrCenterLogo: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -18, width: 36, height: 36, backgroundColor: '#FFF', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#F1F5F9' },
  inputs: { width: '100%', marginTop: 30, gap: 15 },
  inputGroup: { width: '100%' },
  inputLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginBottom: 8 },
  input: { height: 50, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 15, fontSize: 14, fontWeight: '700', color: '#1E293B', borderWidth: 1, borderColor: '#F1F5F9' },
  riderInfo: { fontSize: 11, fontWeight: '900', color: '#CBD5E1', marginTop: 25, letterSpacing: 1 },

  footer: { paddingBottom: 30, alignItems: 'center' },
  securityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  securityLabel: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5 }
});
