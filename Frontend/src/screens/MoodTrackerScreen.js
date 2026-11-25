import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
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
  const { theme } = useThemeContext();
  
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.colors.inputBackground }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Mood Tracker</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>How are you feeling today?</Text>
        <View style={styles.moodGrid}>
          {MOODS.map(m => (
            <TouchableOpacity 
              key={m.id}
              style={[
                styles.moodItem,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                selectedMood === m.id && { borderColor: m.color, backgroundColor: m.color + '25' }
              ]}
              onPress={() => setSelectedMood(m.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.moodIcon}>{m.icon}</Text>
              <Text style={[styles.moodLabel, { color: theme.colors.text }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedMood && (
          <View style={styles.noteSection}>
            <TextInput
              style={[styles.noteInput, { backgroundColor: theme.colors.card, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Add a note (optional)..."
              placeholderTextColor={theme.colors.textSecondary}
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

        <Text style={[styles.sectionTitle, { marginTop: 30, color: theme.colors.text }]}>Recent Moods</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#ff6b81" style={{ marginTop: 20 }} />
        ) : moodLogs.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No moods logged yet.</Text>
        ) : (
          moodLogs.map(log => {
            const isMe = log.user === user?._id;
            const moodObj = MOODS.find(m => m.id === log.mood) || MOODS[0];
            const date = new Date(log.date);
            
            return (
              <View key={log._id} style={[styles.logCard, { backgroundColor: theme.colors.card, borderLeftColor: moodObj.color }]}>
                <View style={styles.logHeader}>
                  <Text style={[styles.logUser, { color: theme.colors.text }]}>{isMe ? 'You' : 'Partner'} felt {moodObj.label} {moodObj.icon}</Text>
                  <Text style={[styles.logDate, { color: theme.colors.textSecondary }]}>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                {log.note ? <Text style={[styles.logNote, { color: theme.colors.textSecondary }]}>{log.note}</Text> : null}
              </View>
            );
          })
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 15,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  moodItem: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    borderWidth: 2,
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
  },
  noteSection: {
    marginTop: 10,
  },
  noteInput: {
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
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
    marginTop: 20,
  },
  logCard: {
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
  },
  logDate: {
    fontSize: 12,
  },
  logNote: {
    fontSize: 14,
  }
});
