import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Vibration, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useAuth } from './AuthContext';
import axiosInstance from '../api/axiosConfig';

const SocketContext = createContext();

// Make sure to replace this with your machine's local IP or backend URL
const SOCKET_URL = 'https://hands-backend.onrender.com'; // Updated for production server

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
      // Use pattern array for reliable vibration on all Androids [delay, duration, delay, duration]
      Vibration.vibrate([0, 500, 200, 500]);
      Toast.show({ type: 'info', text1: 'Miss You! ❤️', text2: 'Your partner misses you!', position: 'top' });
      // Show Hearts Animation
      setAnimationType('miss_you');
      setTimeout(() => setAnimationType(null), 5000);
    });

    // Listen for 'Love You' events
    newSocket.on('receive_love_you', () => {
      Vibration.vibrate([0, 500, 200, 500]);
      Toast.show({ type: 'info', text1: 'Love You! 😘', text2: 'Your partner loves you!', position: 'top' });
      // Show Love Animation
      setAnimationType('love_you');
      setTimeout(() => setAnimationType(null), 5000);
    });

    // Listen for Notifications
    newSocket.on('receive_notification', ({ title, message }) => {
      Vibration.vibrate([0, 300]);
      Toast.show({ type: 'info', text1: title, text2: message, position: 'top' });
    });

    // Listen for Heartbeat
    newSocket.on('receive_heartbeat', ({ senderName }) => {
      console.log('Heartbeat Socket Received');
      // Universal Vibration for all Androids
      try {
        Vibration.vibrate([0, 500, 200, 500]);
        if (Platform.OS !== 'android') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (err) {
        console.error('Vibration failed', err);
      }

      Toast.show({ type: 'info', text1: 'Heartbeat! 💓', text2: `${senderName || 'Your partner'} sent a heartbeat!`, position: 'top' });

      setAnimationType('heartbeat');
      setTimeout(() => setAnimationType(null), 3000);
    });

    // Check for pending animation on load
    if (user?.pendingAnimation) {
      if (user.pendingAnimation === 'love_you' || user.pendingAnimation === 'miss_you') {
        setAnimationType(user.pendingAnimation);
        setTimeout(() => setAnimationType(null), 5000);
        // Clear it on backend
        axiosInstance.post('/auth/clear-animation').catch(e => console.log('Error clearing animation', e));
      }
    }

    return () => newSocket.close();
  }, [userId, partnerId, user?.pendingAnimation]);

  const sendMissYou = () => {
    if (socket && userId && partnerId) {
      const room = [userId, partnerId].sort().join('_');
      socket.emit('send_miss_you', { room, partnerId, senderId: userId, senderName: user?.fullName || user?.username });

      // Visual feedback for sender
      Vibration.vibrate([0, 100]);
      setAnimationType('miss_you');
      setTimeout(() => setAnimationType(null), 4000);
      Toast.show({ type: 'success', text1: 'Sent! ❤️', text2: 'Your partner knows you miss them.' });
    }
  };

  const sendLoveYou = () => {
    if (socket && userId && partnerId) {
      const room = [userId, partnerId].sort().join('_');
      socket.emit('send_love_you', { room, partnerId, senderId: userId, senderName: user?.fullName || user?.username });

      // Visual feedback for sender
      Vibration.vibrate([0, 100]);
      setAnimationType('love_you');
      setTimeout(() => setAnimationType(null), 4000);
      Toast.show({ type: 'success', text1: 'Sent! 😘', text2: 'Your partner knows you love them.' });
    }
  };

  const sendHeartbeat = () => {
    if (socket && user?.partner) {
      const partnerId = typeof user.partner === 'object' ? user.partner._id : user.partner;
      const userId = user._id;
      const room = [userId, partnerId].sort().join('_');
      socket.emit('send_heartbeat', { room, partnerId, senderId: userId, senderName: user?.fullName || user?.username });
      
      // Visual & Haptic feedback for sender
      try {
        Vibration.vibrate([0, 150]); 
      } catch (e) {
        console.log(e);
      }

      setAnimationType('heartbeat');
      setTimeout(() => setAnimationType(null), 3000);
    }
  };

  const sendNotification = (title, message) => {
    if (socket && userId && partnerId) {
      const room = [userId, partnerId].sort().join('_');
      socket.emit('send_notification', { room, partnerId, title, message });
    }
  };

  return (
    <SocketContext.Provider value={{ socket, sendMissYou, sendLoveYou, sendHeartbeat, sendNotification, animationType }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
