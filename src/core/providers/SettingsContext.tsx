import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsContextType {
  darkMode: boolean;
  notifications: boolean;
  locationSharing: boolean;
  setDarkMode: (val: boolean) => void;
  setNotifications: (val: boolean) => void;
  setLocationSharing: (val: boolean) => void;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [darkMode, setDarkModeState] = useState(false);
  const [notifications, setNotificationsState] = useState(true);
  const [locationSharing, setLocationSharingState] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await AsyncStorage.getItem('@app_settings');
        if (savedSettings) {
          const { darkMode, notifications, locationSharing } = JSON.parse(savedSettings);
          setDarkModeState(darkMode ?? false);
          setNotificationsState(notifications ?? true);
          setLocationSharingState(locationSharing ?? true);
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const saveSettings = async (updates: Partial<{ darkMode: boolean; notifications: boolean; locationSharing: boolean }>) => {
    try {
      const current = { darkMode, notifications, locationSharing };
      const next = { ...current, ...updates };
      await AsyncStorage.setItem('@app_settings', JSON.stringify(next));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const setDarkMode = (val: boolean) => {
    setDarkModeState(val);
    saveSettings({ darkMode: val });
  };

  const setNotifications = (val: boolean) => {
    setNotificationsState(val);
    saveSettings({ notifications: val });
  };

  const setLocationSharing = (val: boolean) => {
    setLocationSharingState(val);
    saveSettings({ locationSharing: val });
  };

  return (
    <SettingsContext.Provider 
      value={{ 
        darkMode, 
        notifications, 
        locationSharing, 
        setDarkMode, 
        setNotifications, 
        setLocationSharing,
        loading 
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
