import React, { createContext, useState, useEffect, useContext } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import axiosInstance from '../api/axiosConfig';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync() {
  let token;
  
  // Expo Go completely removed Push Notifications in SDK 53+
  if (Constants.appOwnership === 'expo') {
    console.log('Push notifications are not supported in Expo Go. Use a development build.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }
    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId ?? "dummy-project-id";
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e) {
      console.log('Error getting token', e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }
  return token;
}

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const updatePushTokenInBackend = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await axiosInstance.put('/auth/push-token', { pushToken: token });
      }
    } catch (error) {
      console.log('Error updating push token:', error);
    }
  };

  // Check token on initial load
  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        const response = await axiosInstance.get('/auth/me');
        setUser(response.data);
        updatePushTokenInBackend();
      }
    } catch (error) {
      console.log('Failed to load user:', error.message);
      await AsyncStorage.removeItem('userToken');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (email, password) => {
    const response = await axiosInstance.post('/auth/login', { email, password });
    const { token, ...userData } = response.data;
    await AsyncStorage.setItem('userToken', token);
    setUser(userData);
    updatePushTokenInBackend();
    return response.data;
  };

  const register = async (fullName, username, phoneNumber, email, password) => {
    const response = await axiosInstance.post('/auth/register', {
      fullName,
      username,
      phoneNumber,
      email,
      password
    });
    const { token, ...userData } = response.data;
    await AsyncStorage.setItem('userToken', token);
    setUser(userData);
    updatePushTokenInBackend();
    return response.data;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('userToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser, loadUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
