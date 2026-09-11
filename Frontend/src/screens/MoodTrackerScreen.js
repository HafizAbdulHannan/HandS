import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../api/axiosConfig';
import Toast from 'react-native-toast-message';

const MOODS = [
  { id: 'happy', icon: '😄', label: 'Happy', color: '#FFD700' },
  { id: 'loved', icon: '🥰', label: 'Loved', color: '#ff6b81' },
  { id: 'excited', icon: '🤩', label: 'Excited', color: '#FF8C00' },
  { id: 'tired', icon: '🥱', label: 'Tired', color: '#8A2BE2' },
  { id: 'stressed', icon: '😫', label: 'Stressed', color: '#FF4500' },
  { id: 'sad', icon: '😢', label: 'Sad', color: '#4682B4' },
  { id: 'angry', icon: '😠', label: 'Angry', color: '#DC143C' },
];

export default function MoodTrackerScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  
  const [moodLogs, setMoodLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMood, setSelectedMood] = useState(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchMoods();
  }, []);

  const fetchMoods = async () => {
    try {
      const response = await axiosInstance.get('/moods');
      setMoodLogs(response.data);
    } catch (error) {
      console.log('Error fetching moods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogMood = async () => {
    if (!selectedMood) return;
    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post('/moods', {
        mood: selectedMood,
        note: note.trim()
      });
      setMoodLogs([response.data, ...moodLogs]);
      setSelectedMood(null);
      setNote('');
      Toast.show({ type: 'success', text1: 'Mood logged!' });
    } catch (error) {
      console.log('Error logging mood', error);
      Toast.show({ type: 'error', text1: 'Failed to log mood' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.title}>Mood Tracker</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>How are you feeling today?</Text>
        <View style={styles.moodGrid}>
          {MOODS.map(m => (
            <TouchableOpacity 
              key={m.id}
              style={[styles.moodItem, selectedMood === m.id && { borderColor: m.color, backgroundColor: m.color + '20' }]}
              onPress={() => setSelectedMood(m.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.moodIcon}>{m.icon}</Text>
              <Text style={styles.moodLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedMood && (
          <View style={styles.noteSection}>
            <TextInput
              style={styles.noteInput}
              placeholder="Add a note (optional)..."
              value={note}
              onChangeText={setNote}
              multiline
            />
            <TouchableOpacity 
              style={styles.submitBtn}
              onPress={handleLogMood}
              disabled={isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Log Mood</Text>}
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Recent Moods</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#ff6b81" style={{ marginTop: 20 }} />
        ) : moodLogs.length === 0 ? (
          <Text style={styles.emptyText}>No moods logged yet.</Text>
        ) : (
          moodLogs.map(log => {
            const isMe = log.user === user._id;
            const moodObj = MOODS.find(m => m.id === log.mood) || MOODS[0];
            const date = new Date(log.date);
            
            return (
              <View key={log._id} style={[styles.logCard, { borderLeftColor: moodObj.color }]}>
                <View style={styles.logHeader}>
                  <Text style={styles.logUser}>{isMe ? 'You' : 'Partner'} felt {moodObj.label} {moodObj.icon}</Text>
                  <Text style={styles.logDate}>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                {log.note ? <Text style={styles.logNote}>{log.note}</Text> : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcfcfc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f3f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 15,
    color: '#1a1a1a',
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  moodItem: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#f1f1f1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  moodIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  moodLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  noteSection: {
    marginTop: 10,
  },
  noteInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e1e1e1',
    marginBottom: 15,
  },
  submitBtn: {
    backgroundColor: '#ff6b81',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 20,
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logUser: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  logDate: {
    fontSize: 12,
    color: '#888',
  },
  logNote: {
    fontSize: 14,
    color: '#555',
  }
});
