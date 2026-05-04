import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useSettings } from './SettingsContext';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { darkMode } = useSettings();
  
  return (
    <NavigationThemeProvider value={darkMode ? DarkTheme : DefaultTheme}>
      {children}
    </NavigationThemeProvider>
  );
};
