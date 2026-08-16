import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import axiosInstance, { STATIC_URL } from '../api/axiosConfig';
import * as DocumentPicker from 'expo-document-picker';
import { createAudioPlayer } from 'expo-audio';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';

export default function DatesToRememberScreen() {
  const { theme } = useThemeContext();
  const { user } = useAuth();
  const navigation = useNavigation();

  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form states
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Audio playback state
  const [sound, setSound] = useState();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingId, setPlayingId] = useState(null);

  useEffect(() => {
    fetchDates();
    return () => {
      if (sound) {
        sound.remove();
      }
    };
  }, [sound]);

  const fetchDates = async () => {
    try {
      const response = await axiosInstance.get('/dates');
      setDates(response.data);
    } catch (error) {
      console.log('Error fetching dates:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load dates' });
    } finally {
      setLoading(false);
    }
  };

  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedAudio({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'audio/mpeg',
        });
      }
    } catch (err) {
      console.log('Error picking audio:', err);
    }
  };

  const handleSaveDate = async () => {
    if (!title.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a title' });
      return;
    }

    setIsSubmitting(true);
    try {
      let audioUrl = '';

      if (selectedAudio) {
        const formData = new FormData();
        formData.append('media', {
          uri: selectedAudio.uri,
          name: selectedAudio.name,
          type: selectedAudio.type,
        });

        const uploadRes = await axiosInstance.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        audioUrl = uploadRes.data;
      }

      await axiosInstance.post('/dates', {
        title,
        date,
        customSoundUrl: audioUrl
      });

      Toast.show({ type: 'success', text1: 'Success', text2: 'Date saved successfully!' });
      setModalVisible(false);
      resetForm();
      fetchDates();
    } catch (error) {
      console.log('Error saving date:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save date' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    Alert.alert('Delete Date', 'Are you sure you want to delete this date event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await axiosInstance.delete(`/dates/${id}`);
            setDates(dates.filter(d => d._id !== id));
            Toast.show({ type: 'success', text1: 'Deleted', text2: 'Date deleted' });
          } catch (error) {
            console.log('Error deleting date:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete date' });
          }
        }
      }
    ]);
  };

  const resetForm = () => {
    setTitle('');
    setDate(new Date());
    setSelectedAudio(null);
  };

  const playSound = async (audioUrl, id) => {
    if (!audioUrl) return;

    if (isPlaying && playingId === id) {
      // Stop playing
      sound?.pause();
      setIsPlaying(false);
      setPlayingId(null);
      return;
    }

    try {
      if (sound) {
        sound.pause();
        sound.remove();
      }

      const newSound = createAudioPlayer({ uri: `${STATIC_URL}${audioUrl}` });
      
      setSound(newSound);
      setIsPlaying(true);
      setPlayingId(id);

      newSound.play();

      newSound.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
          setPlayingId(null);
        }
      });
    } catch (error) {
      console.log('Error playing sound:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to play sound' });
    }
  };

  const formatDateTime = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    return new Date(dateString).toLocaleString(undefined, options);
  };

  const renderItem = ({ item }) => {
    const isOwner = item.user?._id === user?._id || item.user === user?._id;
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{item.title}</Text>
          {isOwner && (
            <TouchableOpacity onPress={() => handleDelete(item._id)}>
              <Ionicons name="trash-outline" size={20} color="#ff6b81" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.cardDate, { color: theme.colors.primary }]}>{formatDateTime(item.date)}</Text>
        
        {item.customSoundUrl ? (
          <TouchableOpacity 
            style={[styles.audioBtn, { backgroundColor: theme.colors.inputBackground }]} 
            onPress={() => playSound(item.customSoundUrl, item._id)}
          >
            <Ionicons 
              name={isPlaying && playingId === item._id ? "pause-circle" : "play-circle"} 
              size={24} 
              color={theme.colors.primary} 
            />
            <Text style={[styles.audioText, { color: theme.colors.text }]}>
              {isPlaying && playingId === item._id ? "Playing..." : "Play Reminder Sound"}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.noAudioText, { color: theme.colors.textSecondary }]}>No custom sound</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Dates to Remember</Text>
        </View>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={dates}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar" size={60} color={theme.colors.textSecondary} style={{ opacity: 0.5, marginBottom: 15 }} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No dates to remember yet.</Text>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
              <Text style={{ fontSize: 16, color: theme.colors.text }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add Date</Text>
            <TouchableOpacity onPress={handleSaveDate} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.primary }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Event Title</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
              placeholder="e.g. Anniversary"
              placeholderTextColor={theme.colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={[styles.label, { color: theme.colors.textSecondary, marginTop: 20 }]}>Date & Time</Text>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={date}
                mode="datetime"
                display="spinner"
                onValueChange={(selectedDate) => {
                  const currentDate = selectedDate || date;
                  setDate(currentDate);
                }}
                style={{ height: 120 }}
              />
            ) : (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity 
                  style={[styles.input, { flex: 1, backgroundColor: theme.colors.inputBackground, justifyContent: 'center' }]} 
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={{ color: theme.colors.text }}>{new Date(date).toLocaleDateString()}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.input, { flex: 1, backgroundColor: theme.colors.inputBackground, justifyContent: 'center' }]} 
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={{ color: theme.colors.text }}>{new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    onValueChange={(selectedDate) => {
                      if (selectedDate) {
                        const newDate = new Date(date);
                        newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                        setDate(newDate);
                      }
                    }}
                    onDismiss={() => setShowDatePicker(false)}
                  />
                )}
                {showTimePicker && (
                  <DateTimePicker
                    value={date}
                    mode="time"
                    display="default"
                    onValueChange={(selectedDate) => {
                      if (selectedDate) {
                        const newDate = new Date(date);
                        newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
                        setDate(newDate);
                      }
                    }}
                    onDismiss={() => setShowTimePicker(false)}
                  />
                )}
              </View>
            )}

            <Text style={[styles.label, { color: theme.colors.textSecondary, marginTop: 20 }]}>Reminder Sound</Text>
            <TouchableOpacity 
              style={[styles.uploadBtn, { borderColor: theme.colors.primary }]} 
              onPress={handlePickAudio}
            >
              <Ionicons name="musical-notes-outline" size={24} color={theme.colors.primary} />
              <Text style={[styles.uploadText, { color: theme.colors.primary }]}>
                {selectedAudio ? selectedAudio.name : 'Select Audio File'}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.helpText, { color: theme.colors.textSecondary }]}>
              This sound will play when you open the app on this date.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardDate: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 16,
  },
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
  },
  audioText: {
    marginLeft: 10,
    fontWeight: '500',
  },
  noAudioText: {
    fontStyle: 'italic',
    fontSize: 13,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  uploadText: {
    marginLeft: 10,
    fontWeight: '600',
    fontSize: 16,
  },
  helpText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  }
});
