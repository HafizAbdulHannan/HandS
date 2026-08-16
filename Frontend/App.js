import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SocketProvider } from './src/context/SocketContext';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useThemeContext } from './src/context/ThemeContext';
import Toast from 'react-native-toast-message';

function AppContent() {
  const { isDarkMode } = useThemeContext();

  return (
    <SocketProvider>
      <NavigationContainer theme={isDarkMode ? DarkTheme : DefaultTheme}>
        <AppNavigator />
      </NavigationContainer>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
    </SocketProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
          <Toast />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
