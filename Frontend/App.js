import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SocketProvider } from './src/context/SocketContext';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useThemeContext } from './src/context/ThemeContext';
import Toast from 'react-native-toast-message';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from './src/api/axiosConfig';

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error(error);
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const loc = locations[0];
      try {
        const isSharingLive = await AsyncStorage.getItem('isSharingLive');
        if (isSharingLive === 'true') {
          await axiosInstance.put('/auth/location', {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch (e) {
        console.log('Background location update failed:', e);
      }
    }
  }
});

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
