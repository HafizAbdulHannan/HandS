import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// If you are using Android Emulator, use 10.0.2.2 instead of localhost
// If testing on a physical device, use your computer's local IP address (e.g., 192.168.1.5)
export const STATIC_URL = 'https://hands-backend.onrender.com';
const BASE_URL = `${STATIC_URL}/api`;

export const getMediaUrl = (path) => {
  if (!path) return null;
  // If it's already a base64 string, return it as is
  if (path.startsWith('data:image')) return path;
  
  let normalizedPath = path.replace(/\\/g, '/');
  if (normalizedPath.startsWith('http')) return normalizedPath;
  return normalizedPath.startsWith('/') ? `${STATIC_URL}${normalizedPath}` : `${STATIC_URL}/${normalizedPath}`;
};

const axiosInstance = axios.create({
  baseURL: BASE_URL,
});

// Add a request interceptor to automatically attach the token
axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('userToken');
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
