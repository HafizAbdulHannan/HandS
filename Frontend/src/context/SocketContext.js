import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

// Make sure to replace this with your machine's local IP or backend URL
const SOCKET_URL = 'https://hands-production-0d9f.up.railway.app'; // Updated for production server

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [animationType, setAnimationType] = useState(null); // 'miss_you' | 'love_you' | null
  const { user } = useAuth();
  
  const userId = user?._id;
  const partnerId = user?.partner;

  useEffect(() => {
    if (!userId || !partnerId) return;

    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    // Join the unique room for this pair
    newSocket.emit('join_pair_room', { userId, partnerId });

    // Listen for 'Miss You' events
    newSocket.on('receive_miss_you', () => {
      // Trigger Haptic feedback & Strong Vibration
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Vibration.vibrate([0, 500, 200, 500]);
      Toast.show({ type: 'info', text1: 'Miss You! ❤️', text2: 'Your partner misses you!', position: 'top' });
      // Show Hearts Animation
      setAnimationType('miss_you');
      setTimeout(() => setAnimationType(null), 5000);
    });

    // Listen for 'Love You' events
    newSocket.on('receive_love_you', () => {
      // Trigger Haptic feedback & Strong Vibration
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Vibration.vibrate([0, 500, 200, 500]);
      Toast.show({ type: 'info', text1: 'Love You! 😘', text2: 'Your partner loves you!', position: 'top' });
      // Show Love Animation
      setAnimationType('love_you');
      setTimeout(() => setAnimationType(null), 5000);
    });

    // Listen for Notifications
    newSocket.on('receive_notification', ({ title, message }) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'info', text1: title, text2: message, position: 'top' });
    });

    return () => newSocket.close();
  }, [userId, partnerId]);

  const sendMissYou = () => {
    if (socket && userId && partnerId) {
      const room = [userId, partnerId].sort().join('_');
      socket.emit('send_miss_you', { room, partnerId });
      
      // Visual feedback for sender
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setAnimationType('miss_you');
      setTimeout(() => setAnimationType(null), 4000);
      Toast.show({ type: 'success', text1: 'Sent! ❤️', text2: 'Your partner knows you miss them.' });
    }
  };

  const sendLoveYou = () => {
    if (socket && userId && partnerId) {
      const room = [userId, partnerId].sort().join('_');
      socket.emit('send_love_you', { room, partnerId });
      
      // Visual feedback for sender
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setAnimationType('love_you');
      setTimeout(() => setAnimationType(null), 4000);
      Toast.show({ type: 'success', text1: 'Sent! 😘', text2: 'Your partner knows you love them.' });
    }
  };

  const sendNotification = (title, message) => {
    if (socket && userId && partnerId) {
      const room = [userId, partnerId].sort().join('_');
      socket.emit('send_notification', { room, partnerId, title, message });
    }
  };

  return (
    <SocketContext.Provider value={{ socket, sendMissYou, sendLoveYou, sendNotification, animationType }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
