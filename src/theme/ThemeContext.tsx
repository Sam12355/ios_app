import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Colors, DesignColors, getDesignColors, getThemeColors, ThemeColors } from './colors';

interface ThemeContextType {
  isDark: boolean;
  isDarkMode: boolean;  // Alias for isDark
  colors: ThemeColors;
  designColors: DesignColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@stocknexus_theme';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  // Default to dark theme
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    loadStoredTheme();
  }, []);

  const loadStoredTheme = async () => {
    try {
      const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme !== null) {
        setIsDark(storedTheme === 'dark');
      } else {
        // First launch - save dark theme as default
        await AsyncStorage.setItem(THEME_STORAGE_KEY, 'dark');
        setIsDark(true);
      }
    } catch (error) {
      console.log('Error loading theme:', error);
      // On error, ensure dark theme
      setIsDark(true);
    }
  };

  const toggleTheme = async () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newIsDark ? 'dark' : 'light');
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  };

  const colors = getThemeColors(isDark);
  const designColors = getDesignColors(isDark);

  return (
    <ThemeContext.Provider value={{ isDark, isDarkMode: isDark, colors, designColors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export { Colors, getDesignColors };
