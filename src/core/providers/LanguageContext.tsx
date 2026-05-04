import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/i18n';

type LanguageType = 'en' | 'ta' | 'hi' | 'kn' | 'ml' | 'te';

interface LanguageContextType {
  language: LanguageType;
  changeLanguage: (lng: LanguageType) => Promise<void>;
  isReady: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageType>('en');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('@app_language');
        if (savedLanguage) {
          const lng = savedLanguage as LanguageType;
          await i18n.changeLanguage(lng);
          setLanguageState(lng);
        }
      } catch (e) {
        console.error('Failed to load language:', e);
      } finally {
        setIsReady(true);
      }
    };
    loadLanguage();
  }, []);

  const changeLanguage = async (lng: LanguageType) => {
    try {
      await i18n.changeLanguage(lng);
      setLanguageState(lng);
      await AsyncStorage.setItem('@app_language', lng);
    } catch (e) {
      console.error('Failed to change language:', e);
    }
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, isReady }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
