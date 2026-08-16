import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// If you are using Android Emulator, use 10.0.2.2 instead of localhost
// If testing on a physical device, use your computer's local IP address (e.g., 192.168.1.5)
export const STATIC_URL = 'https://hands-production-0d9f.up.railway.app';
const BASE_URL = `${STATIC_URL}/api`;

const axiosInstance = axios.create({
  baseURL: BASE_URL,
});

// Add a request interceptor to automatically attach the token
axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default axiosInstance;
