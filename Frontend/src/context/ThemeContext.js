import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [themeLoading, setThemeLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('isDarkMode');
      if (savedTheme !== null) {
        setIsDarkMode(JSON.parse(savedTheme));
      }
    } catch (error) {
      console.log('Error loading theme:', error);
    } finally {
      setThemeLoading(false);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem('isDarkMode', JSON.stringify(newTheme));
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  };

  const theme = {
    isDarkMode,
    colors: {
      background: isDarkMode ? '#121212' : '#ffffff',
      card: isDarkMode ? '#1e1e1e' : '#ffffff',
      text: isDarkMode ? '#ffffff' : '#1a1a1a',
      textSecondary: isDarkMode ? '#a0a0a0' : '#888888',
      border: isDarkMode ? '#333333' : '#f1f1f1',
      primary: '#ff6b81',
      icon: isDarkMode ? '#ffffff' : '#1a1a1a',
      inputBackground: isDarkMode ? '#2c2c2c' : '#f5f5f5',
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, theme, themeLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => useContext(ThemeContext);
