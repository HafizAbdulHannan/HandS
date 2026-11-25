import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, AppState, DeviceEventEmitter, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import axiosInstance, { getMediaUrl } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';

const TRIGGERED_DATES_KEY = 'hands_triggered_dates_v1';
const SCHEDULED_DATES_KEY = 'hands_scheduled_dates_v1';

export default function DateReminderManager() {
  const { user } = useAuth();
  const { theme } = useThemeContext();

  const [activeReminder, setActiveReminder] = useState(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const datesRef = useRef([]);
  const triggeredIdsRef = useRef(new Set());
  const soundRef = useRef(null);

  const stopReminderAudio = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
    }
    setIsAudioPlaying(false);
  }, []);

  const playReminderAudio = useCallback(async (audioUrl) => {
    if (!audioUrl) return;
    try {
      await stopReminderAudio();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      const resolved = getMediaUrl(audioUrl);
      if (!resolved) return;

      const { sound } = await Audio.Sound.createAsync(
        { uri: resolved },
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;
      setIsAudioPlaying(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsAudioPlaying(false);
          sound.unloadAsync().catch(() => {});
          if (soundRef.current === sound) {
            soundRef.current = null;
          }
        }
      });
    } catch (error) {
      console.log('Auto-play reminder audio error:', error);
    }
  }, [stopReminderAudio]);

  const markDateTriggered = useCallback(async (dateId) => {
    if (!dateId) return;
    const idStr = String(dateId);
    triggeredIdsRef.current.add(idStr);
    try {
      const arr = Array.from(triggeredIdsRef.current).slice(-100);
      await AsyncStorage.setItem(TRIGGERED_DATES_KEY, JSON.stringify(arr));
    } catch (e) {}
  }, []);

  const triggerReminderNow = useCallback(async (reminderObj, forcePlay = false) => {
    if (!reminderObj) return;
    const idStr = String(reminderObj._id || reminderObj.dateId || '');
    if (idStr && !forcePlay && triggeredIdsRef.current.has(idStr)) {
      return;
    }
    if (idStr) {
      await markDateTriggered(idStr);
    }

    setActiveReminder({
      id: idStr,
      title: reminderObj.title || 'Special Date Reminder',
      date: reminderObj.date || new Date().toISOString(),
      customSoundUrl: reminderObj.customSoundUrl || '',
    });

    if (reminderObj.customSoundUrl) {
      await playReminderAudio(reminderObj.customSoundUrl);
    }
  }, [markDateTriggered, playReminderAudio]);

  const syncDatesAndSchedules = useCallback(async () => {
    if (!user?._id) return;
    try {
      const res = await axiosInstance.get('/dates');
      const fetchedDates = Array.isArray(res.data) ? res.data : [];
      datesRef.current = fetchedDates;

      // Sync local scheduled notifications for all upcoming dates (including partner's)
      const rawScheduled = await AsyncStorage.getItem(SCHEDULED_DATES_KEY);
      const scheduledMap = rawScheduled ? JSON.parse(rawScheduled) : {};
      let mapChanged = false;
      const now = Date.now();

      for (const item of fetchedDates) {
        const idStr = String(item._id);
        const eventTime = new Date(item.date).getTime();
        if (eventTime > now + 2000 && !scheduledMap[idStr]) {
          try {
            const notifId = await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Date Reminder! ❤️',
                body: `It's time for: ${item.title}`,
                sound: item.customSoundUrl ? false : true,
                ...(Platform.OS === 'android' ? { channelId: 'date_reminders' } : {}),
                data: {
                  type: 'date_reminder',
                  customSoundUrl: item.customSoundUrl || '',
                  dateId: idStr,
                  title: item.title,
                  date: item.date,
                },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes?.DATE || 'date',
                date: new Date(eventTime),
              },
            });
            scheduledMap[idStr] = notifId;
            mapChanged = true;
          } catch (schedErr) {
            console.log('Schedule sync error:', schedErr);
          }
        }
      }

      if (mapChanged) {
        await AsyncStorage.setItem(SCHEDULED_DATES_KEY, JSON.stringify(scheduledMap));
      }
    } catch (error) {
      // silent background sync
    }
  }, [user?._id]);

  // Load previously triggered IDs on mount
  useEffect(() => {
    if (!user?._id) return;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TRIGGERED_DATES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            triggeredIdsRef.current = new Set(parsed.map(String));
          }
        }
      } catch (e) {}
      await syncDatesAndSchedules();
    })();

    const refreshSub = DeviceEventEmitter.addListener('dates_updated', () => {
      syncDatesAndSchedules();
    });

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncDatesAndSchedules();
      }
    });

    // Foreground arrival listener — auto-plays audio the instant the reminder notification arrives
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification?.request?.content?.data || {};
      if (data.type === 'date_reminder' || data.dateId) {
        triggerReminderNow(
          {
            dateId: data.dateId,
            title: data.title || notification?.request?.content?.body || 'Date Reminder',
            date: data.date,
            customSoundUrl: data.customSoundUrl,
          },
          false
        );
      }
    });

    // Tap listener (when app was backgrounded/closed) — auto-plays audio immediately when opened
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      if (data.type === 'date_reminder' || data.dateId) {
        triggerReminderNow(
          {
            dateId: data.dateId,
            title: data.title || response?.notification?.request?.content?.body || 'Date Reminder',
            date: data.date,
            customSoundUrl: data.customSoundUrl,
          },
          true
        );
      }
    });

    // Precise clock watcher every 5 seconds while app is open
    const checkDueReminders = () => {
      if (AppState.currentState !== 'active') return;
      const now = Date.now();
      for (const item of datesRef.current) {
        const idStr = String(item._id);
        if (triggeredIdsRef.current.has(idStr)) continue;
        const eventMs = new Date(item.date).getTime();
        const diff = now - eventMs;
        // Fire automatically once scheduled time is reached (within a 3-minute window)
        if (diff >= 0 && diff <= 3 * 60 * 1000) {
          triggerReminderNow(item, false);
          break;
        }
      }
    };

    const clockInterval = setInterval(checkDueReminders, 5000);
    const syncInterval = setInterval(syncDatesAndSchedules, 60000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(syncInterval);
      refreshSub.remove();
      appStateSub.remove();
      receivedSub.remove();
      responseSub.remove();
      stopReminderAudio();
    };
  }, [user?._id, syncDatesAndSchedules, triggerReminderNow, stopReminderAudio]);

  const handleDismiss = async () => {
    await stopReminderAudio();
    setActiveReminder(null);
  };

  const handleDeleteReminder = async () => {
    const id = activeReminder?.id;
    await stopReminderAudio();
    setActiveReminder(null);
    if (!id) return;
    try {
      await axiosInstance.delete(`/dates/${id}`);
      DeviceEventEmitter.emit('dates_updated');
      Toast.show({ type: 'success', text1: 'Deleted', text2: 'Reminder deleted.' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not delete reminder.' });
    }
  };

  if (!activeReminder) return null;

  return (
    <Modal visible={!!activeReminder} transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="alarm" size={34} color="#ff6b81" />
          </View>
          <Text style={[styles.badgeText, { color: theme.colors.primary }]}>DATE REMINDER</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>{activeReminder.title}</Text>
          {activeReminder.date ? (
            <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
              {new Date(activeReminder.date).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          ) : null}

          {activeReminder.customSoundUrl ? (
            <TouchableOpacity
              style={[styles.audioControlBtn, { backgroundColor: theme.colors.inputBackground }]}
              onPress={() => {
                if (isAudioPlaying) {
                  stopReminderAudio();
                } else {
                  playReminderAudio(activeReminder.customSoundUrl);
                }
              }}
            >
              <Ionicons
                name={isAudioPlaying ? 'stop-circle' : 'play-circle'}
                size={24}
                color={theme.colors.primary}
              />
              <Text style={[styles.audioControlText, { color: theme.colors.text }]}>
                {isAudioPlaying ? 'Stop Reminder Audio' : 'Replay Reminder Audio'}
              </Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleDismiss}
            >
              <Text style={styles.actionBtnText}>Keep</Text>
            </TouchableOpacity>
            {activeReminder.id ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: 'rgba(255, 71, 87, 0.14)' }]}
                onPress={handleDeleteReminder}
              >
                <Text style={[styles.actionBtnText, { color: '#ff4757' }]}>Delete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    elevation: 10,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 107, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  timeText: {
    fontSize: 14,
    marginBottom: 18,
  },
  audioControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    width: '100%',
    marginBottom: 18,
    gap: 8,
  },
  audioControlText: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
