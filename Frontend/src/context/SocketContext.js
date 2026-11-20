import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Vibration, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useAuth } from './AuthContext';
import axiosInstance from '../api/axiosConfig';

const SocketContext = createContext();

const SOCKET_URL = 'https://hands-backend.onrender.com';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [animationType, setAnimationType] = useState(null); // 'miss_you' | 'love_you' | 'heartbeat' | null
  const { user } = useAuth();
  const animationTimeoutRef = useRef(null);
  const hapticTimeoutsRef = useRef([]);

  const userId = user?._id;
  const partnerId = typeof user?.partner === 'object' ? user?.partner?._id : user?.partner;

  const clearHapticTimeouts = useCallback(() => {
    hapticTimeoutsRef.current.forEach((t) => clearTimeout(t));
    hapticTimeoutsRef.current = [];
  }, []);

  const showTimedAnimation = useCallback((type, durationMs) => {
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    setAnimationType(type);
    animationTimeoutRef.current = setTimeout(() => {
      setAnimationType(null);
      animationTimeoutRef.current = null;
    }, durationMs);
  }, []);

  // Heartbeat vibration increased by ~5% (120ms -> 126ms, 220ms -> 231ms)
  const triggerHeartbeatVibration = useCallback(() => {
    try {
      clearHapticTimeouts();
      if (Platform.OS === 'android') {
        Vibration.cancel();
        // Realistic Heartbeat Rhythm (+5% pulse intensity): lub-dub ... lub-dub ... lub-dub
        Vibration.vibrate([0, 126, 120, 231, 600, 126, 120, 231, 600, 126, 120, 231]);
      } else {
        // iOS Haptic simulation of lub-dub (+5% timing/pulse boost)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        hapticTimeoutsRef.current.push(
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 189),
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 987),
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 1176),
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 1974),
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 2163)
        );
      }
    } catch (err) {
      console.warn('Vibration failed:', err);
    }
  }, [clearHapticTimeouts]);

  useEffect(() => {
    if (!userId) {
      setSocket(null);
      return;
    }

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('register_user', { userId });
      if (partnerId) {
        newSocket.emit('join_pair_room', { userId, partnerId });
      }
    });

    // Also emit immediately
    newSocket.emit('register_user', { userId });
    if (partnerId) {
      newSocket.emit('join_pair_room', { userId, partnerId });
    }

    // Listen for 'Miss You' events
    newSocket.on('receive_miss_you', () => {
      Vibration.vibrate([0, 500, 200, 500]);
      Toast.show({ type: 'info', text1: 'Miss You! ❤️', text2: 'Your partner misses you!', position: 'top' });
      showTimedAnimation('miss_you', 5000);
    });

    // Listen for 'Love You' events
    newSocket.on('receive_love_you', () => {
      Vibration.vibrate([0, 500, 200, 500]);
      Toast.show({ type: 'info', text1: 'Love You! 😘', text2: 'Your partner loves you!', position: 'top' });
      showTimedAnimation('love_you', 5000);
    });

    // Listen for Notifications
    newSocket.on('receive_notification', ({ title, message }) => {
      Vibration.vibrate([0, 300]);
      Toast.show({ type: 'info', text1: title, text2: message, position: 'top' });
    });

    // Listen for Heartbeat
    newSocket.on('receive_heartbeat', ({ senderName }) => {
      triggerHeartbeatVibration();
      Toast.show({ type: 'info', text1: 'Heartbeat! 💓', text2: `${senderName || 'Your partner'} sent a heartbeat!`, position: 'top' });
      showTimedAnimation('heartbeat', 3500);
    });

    return () => {
      clearHapticTimeouts();
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      newSocket.close();
    };
  }, [userId, partnerId, showTimedAnimation, triggerHeartbeatVibration, clearHapticTimeouts]);

  // Check for pending animation on load
  useEffect(() => {
    const pending = user?.pendingAnimation;
    if (pending === 'love_you' || pending === 'miss_you' || pending === 'heartbeat') {
      if (pending === 'heartbeat') {
        triggerHeartbeatVibration();
      } else {
        Vibration.vibrate([0, 500, 200, 500]);
      }
      showTimedAnimation(pending, pending === 'heartbeat' ? 3500 : 5000);
      axiosInstance.post('/auth/clear-animation').catch((e) => console.log('Error clearing animation', e));
    }
  }, [user?.pendingAnimation, showTimedAnimation, triggerHeartbeatVibration]);

  const sendMissYou = () => {
    if (socket && userId && partnerId) {
      const room = [userId, partnerId].sort().join('_');
      socket.emit('send_miss_you', { room, partnerId, senderId: userId, senderName: user?.fullName || user?.username });

      Vibration.vibrate([0, 100]);
      showTimedAnimation('miss_you', 4000);
      Toast.show({ type: 'success', text1: 'Sent! ❤️', text2: 'Your partner knows you miss them.' });
    } else if (!partnerId) {
      Toast.show({ type: 'info', text1: 'No Partner Connected', text2: 'Connect with your partner to send Miss You.' });
    }
  };

  const sendLoveYou = () => {
    if (socket && userId && partnerId) {
      const room = [userId, partnerId].sort().join('_');
      socket.emit('send_love_you', { room, partnerId, senderId: userId, senderName: user?.fullName || user?.username });

      Vibration.vibrate([0, 100]);
      showTimedAnimation('love_you', 4000);
      Toast.show({ type: 'success', text1: 'Sent! 😘', text2: 'Your partner knows you love them.' });
    } else if (!partnerId) {
      Toast.show({ type: 'info', text1: 'No Partner Connected', text2: 'Connect with your partner to send Love You.' });
    }
  };

  const sendHeartbeat = () => {
    // Immediate vibration & animation for sender
    triggerHeartbeatVibration();
    showTimedAnimation('heartbeat', 3500);

    if (socket && userId && partnerId) {
      const room = [userId, partnerId].sort().join('_');
      socket.emit('send_heartbeat', { room, partnerId, senderId: userId, senderName: user?.fullName || user?.username });
      Toast.show({ type: 'success', text1: 'Heartbeat Sent! 💓', text2: 'Your partner is feeling your heartbeat.' });
    } else if (!partnerId) {
      Toast.show({ type: 'info', text1: 'Heartbeat! 💓', text2: 'Connect with a partner to send heartbeats.' });
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
