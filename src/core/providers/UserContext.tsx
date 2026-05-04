import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RIDER_PROFILE } from '@/core/config/user';

export interface BankData {
  type: 'bank' | 'upi';
  accHolder: string;
  accNumber?: string;
  ifsc?: string;
  bankName?: string;
  upiId?: string;
  bankType?: string;      // Legacy support
  settlementType?: string; // Legacy support
  colorScheme?: string[];  // For the card gradient
}

interface UserContextType {
  riderName: string;
  profileImage: string | null;
  isOnline: boolean;
  setProfileImage: (uri: string | null) => void;
  updateRiderName: (name: string) => void;
  setOnlineStatus: (status: boolean) => void;
  orderStats: { received: number; accepted: number; declined: number };
  trackOrderAction: (action: 'received' | 'accepted' | 'declined') => void;
  bankData: BankData | null;
  updateBankData: (data: BankData) => void;
  tourStep: number | null;
  setTourStep: (step: number | null) => void;
  secondsOnline: number;
  resetSecondsOnline: () => void;
  walletBalance: number;
  updateWalletBalance: (amount: number) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [riderName, setRiderName] = useState(RIDER_PROFILE.name);
  const [profileImage, setProfileImageState] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [orderStats, setOrderStats] = useState({ received: 28, accepted: 24, declined: 4 });
  const [bankData, setBankData] = useState<BankData | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [secondsOnline, setSecondsOnline] = useState<number>(0);

  // Load persisted data on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const savedImage = await AsyncStorage.getItem('@profile_image');
        const savedName = await AsyncStorage.getItem('@rider_name');
        const kycPhoto = await AsyncStorage.getItem('@kyc_profile_photo');
        const savedStatus = await AsyncStorage.getItem('@is_online');
        const savedBank = await AsyncStorage.getItem('@bank_data');
        
        // Priority check for KYC data
        const kycRaw = await AsyncStorage.getItem('@personal_data');
        if (kycRaw) {
          const kycData = JSON.parse(kycRaw);
          if (kycData.fullName) setRiderName(kycData.fullName);
          else if (kycData.name) setRiderName(kycData.name);
        } else if (savedName) {
          setRiderName(savedName);
        }

        if (savedBank) setBankData(JSON.parse(savedBank));

        // Image priority: KYC Selfie -> Profile Upload -> Default
        if (kycPhoto) {
           setProfileImageState(kycPhoto);
        } else if (savedImage) {
           setProfileImageState(savedImage);
        }
        
        if (savedStatus) setIsOnline(savedStatus === 'true');

        const savedStats = await AsyncStorage.getItem('@order_stats');
        if (savedStats) setOrderStats(JSON.parse(savedStats));

        const savedSeconds = await AsyncStorage.getItem('@seconds_online');
        if (savedSeconds) setSecondsOnline(parseInt(savedSeconds));
      } catch (e) {
        console.error('Error loading user data:', e);
      }
    };
    loadUserData();
  }, []);

  const setProfileImage = async (uri: string | null) => {
    try {
      setProfileImageState(uri);
      if (uri) {
        await AsyncStorage.setItem('@profile_image', uri);
        await AsyncStorage.setItem('@kyc_profile_photo', uri); // Sync with KYC
      } else {
        await AsyncStorage.removeItem('@profile_image');
        await AsyncStorage.removeItem('@kyc_profile_photo');
      }
    } catch (e) {
      console.error('Error saving profile image:', e);
    }
  };

  const updateRiderName = async (name: string) => {
    try {
      setRiderName(name);
      await AsyncStorage.setItem('@rider_name', name);
    } catch (e) {
      console.error('Error saving rider name:', e);
    }
  };

  const setOnlineStatus = async (status: boolean) => {
    try {
      setIsOnline(status);
      await AsyncStorage.setItem('@is_online', status ? 'true' : 'false');
    } catch (e) {
      console.error('Error saving online status:', e);
    }
  };

  const resetSecondsOnline = async () => {
    setSecondsOnline(0);
    await AsyncStorage.setItem('@seconds_online', '0');
  };

  useEffect(() => {
    let interval: any;
    if (isOnline) {
      interval = setInterval(() => {
        setSecondsOnline(prev => {
          const next = prev + 1;
          // Persist every 10 seconds to avoid excessive storage calls
          if (next % 10 === 0) {
            AsyncStorage.setItem('@seconds_online', next.toString());
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOnline]);

  const trackOrderAction = async (action: 'received' | 'accepted' | 'declined') => {
    try {
      const newStats = { ...orderStats, [action]: orderStats[action] + 1 };
      setOrderStats(newStats);
      await AsyncStorage.setItem('@order_stats', JSON.stringify(newStats));
    } catch (e) {
      console.error('Error tracking order action:', e);
    }
  };

  const updateBankData = async (data: BankData) => {
    try {
      setBankData(data);
      await AsyncStorage.setItem('@bank_data', JSON.stringify(data));
    } catch (e) {
      console.error('Error saving bank data:', e);
    }
  };

  const [walletBalance, setWalletBalance] = useState(4250.34);

  const updateWalletBalance = async (amount: number) => {
    const newBalance = walletBalance + amount;
    setWalletBalance(newBalance);
    await AsyncStorage.setItem('@wallet_balance', newBalance.toString());
  };

  return (
    <UserContext.Provider value={{ 
      riderName, profileImage, isOnline, orderStats, bankData, tourStep, secondsOnline, walletBalance,
      setProfileImage, updateRiderName, setOnlineStatus, trackOrderAction, updateBankData, setTourStep, resetSecondsOnline, updateWalletBalance
    }}>
      {children}
    </UserContext.Provider>
  );
};


export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
