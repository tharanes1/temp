import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from './LanguageContext';
import { SettingsProvider } from './SettingsContext';
import { UserProvider } from './UserContext';
import { LocationProvider } from '@/features/map/providers/LocationProvider';

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <SettingsProvider>
          <UserProvider>
            <LocationProvider>
              {children}
            </LocationProvider>
          </UserProvider>
        </SettingsProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
};
