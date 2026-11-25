import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { Platform, DeviceEventEmitter } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import axiosInstance from '../api/axiosConfig';

const SAVED_ACCOUNTS_KEY = 'hands_saved_accounts_v1';
const getAccountTokenKey = (accountId) => `userToken_${String(accountId).replace(/[^a-zA-Z0-9._-]/g, '')}`;

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification?.request?.content?.data || {};
    // Suppress foreground push alert/vibration for realtime emotions (heartbeat, love, miss)
    // so Android's notification channel does not interrupt the app's custom heartbeat vibration.
    if (data.type === 'realtime_emotion') {
      return {
        shouldShowAlert: false,
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }
    // For date reminders with custom audio, let DateReminderManager play the custom sound cleanly
    if (data.type === 'date_reminder' && data.customSoundUrl) {
      return {
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }
    return {
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

async function registerForPushNotificationsAsync() {
  let token;


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
    await Notifications.setNotificationChannelAsync('date_reminders', {
      name: 'Date Reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 150, 300],
      lightColor: '#FF6B81',
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
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId ??
        'b2ae7d16-a9fe-4e80-90ce-6b48cddd5049';
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
  const [savedAccounts, setSavedAccounts] = useState([]);
  const isSwitchingAccountRef = useRef(false);

    const readSavedAccountsFromStorage = useCallback(async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setSavedAccounts(parsed);
            return parsed;
          }
        }
      } catch (e) {
        console.log('Error reading saved accounts:', e);
      }
      setSavedAccounts([]);
      return [];
    }, []);

    const upsertSavedAccount = useCallback(async (userData, token = null) => {
      if (!userData || !userData._id) return;
      try {
        const id = String(userData._id);
        if (token) {
          await SecureStore.setItemAsync(getAccountTokenKey(id), token);
        }

        const raw = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
        let list = [];
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list = parsed;
        }

        const entry = {
          _id: id,
          fullName: userData.fullName || '',
          username: userData.username || '',
          email: userData.email || '',
          phoneNumber: userData.phoneNumber || '',
          avatar: userData.avatar || '',
          bio: userData.bio || '',
          lastLoginAt: new Date().toISOString(),
        };

        const filtered = list.filter((acc) => String(acc._id) !== id && acc.email !== entry.email);
        const updated = [entry, ...filtered];
        await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
        setSavedAccounts(updated);
      } catch (e) {
        console.log('Error saving account to device:', e);
      }
    }, []);

    const updatePushTokenInBackend = useCallback(async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          await axiosInstance.put('/auth/push-token', { pushToken: token });
        }
      } catch (error) {
        console.log('Error updating push token:', error);
      }
  }, []);

    const stopBackgroundLocationSafely = useCallback(async () => {
      try {
        await AsyncStorage.removeItem('isSharingLive');
        const hasTask = await Location.hasStartedLocationUpdatesAsync('background-location-task');
        if (hasTask) {
          await Location.stopLocationUpdatesAsync('background-location-task');
        }
      } catch (e) { }
    }, []);

    const loadUser = useCallback(async () => {
      try {
        await readSavedAccountsFromStorage();
        const token = await SecureStore.getItemAsync('userToken');
        if (token) {
          const response = await axiosInstance.get('/auth/me');
          setUser(response.data);
          await upsertSavedAccount(response.data, token);
          updatePushTokenInBackend();
        }
      } catch (error) {
        console.log('Failed to load user:', error.message);
        await SecureStore.deleteItemAsync('userToken');
        setUser(null);
      } finally {
        setLoading(false);
      }
  }, [readSavedAccountsFromStorage, upsertSavedAccount, updatePushTokenInBackend]);

  const logout = useCallback(async () => {
    await stopBackgroundLocationSafely();
    await SecureStore.deleteItemAsync('userToken');
    setUser(null);
  }, [stopBackgroundLocationSafely]);

  useEffect(() => {
    loadUser();

    const logoutListener = DeviceEventEmitter.addListener('force_logout', () => {
      if (!isSwitchingAccountRef.current) {
        logout();
      }
    });

    return () => {
      logoutListener.remove();
    };
}, [loadUser, logout]);

const login = async (email, password) => {
  const response = await axiosInstance.post('/auth/login', { email, password });
  const { token, ...userData } = response.data;
  await SecureStore.setItemAsync('userToken', token);
  await upsertSavedAccount(userData, token);
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
      password,
  });
  const { token, ...userData } = response.data;
  await SecureStore.setItemAsync('userToken', token);
  await upsertSavedAccount(userData, token);
  setUser(userData);
  updatePushTokenInBackend();
  return response.data;
};

  const switchAccount = async (accountId) => {
    const id = String(accountId);
    const savedToken = await SecureStore.getItemAsync(getAccountTokenKey(id));
    if (!savedToken) {
      throw new Error('Saved session expired. Please sign in with your password.');
    }

    const previousToken = await SecureStore.getItemAsync('userToken');
    isSwitchingAccountRef.current = true;
    try {
        await stopBackgroundLocationSafely();
        await SecureStore.setItemAsync('userToken', savedToken);
        const response = await axiosInstance.get('/auth/me');
        const newUserData = response.data;
        await upsertSavedAccount(newUserData, savedToken);
        setUser(newUserData);
        updatePushTokenInBackend();
        return newUserData;
      } catch (error) {
        // Restore previous session if switch failed
        if (previousToken) {
          await SecureStore.setItemAsync('userToken', previousToken);
        } else {
          await SecureStore.deleteItemAsync('userToken');
        }
      if (error?.response?.status === 401) {
        await SecureStore.deleteItemAsync(getAccountTokenKey(id));
        throw new Error('Session expired for this account. Please log in with email and password.');
      }
      throw error;
    } finally {
      isSwitchingAccountRef.current = false;
    }
  };

  const removeSavedAccount = async (accountId) => {
    const id = String(accountId);
    try {
      await SecureStore.deleteItemAsync(getAccountTokenKey(id));
      const raw = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
      let list = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed;
      }
      const updated = list.filter((acc) => String(acc._id) !== id);
      await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
      setSavedAccounts(updated);

      if (user?._id && String(user._id) === id) {
        await logout();
      }
    } catch (e) {
      console.log('Error removing saved account:', e);
    }
  };

  const deleteCurrentAccount = async (password, reason = '') => {
    const currentId = user?._id ? String(user._id) : null;
    await axiosInstance.post('/auth/delete-account', {
      reason,
      password,
    });
    if (currentId) {
      await removeSavedAccount(currentId);
    } else {
      await logout();
    }
  };

  return (
      <AuthContext.Provider
        value={{
          user,
          loading,
          savedAccounts,
          login,
          register,
          logout,
          switchAccount,
          removeSavedAccount,
          deleteCurrentAccount,
          setUser,
          loadUser,
        }}
      >
        {children}
      </AuthContext.Provider>
      );
};

export const useAuth = () => useContext(AuthContext);
