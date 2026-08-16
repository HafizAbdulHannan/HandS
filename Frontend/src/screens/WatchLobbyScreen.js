import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance from '../api/axiosConfig';
import { useThemeContext } from '../context/ThemeContext';

const WatchLobbyScreen = () => {
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { theme } = useThemeContext();

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      Alert.alert('Error', 'Please enter a room name');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axiosInstance.post('/watch/create', { roomName });
      const room = response.data.room;
      navigation.navigate('WatchRoom', { roomCode: room.roomCode, roomId: room._id, isHost: true });
    } catch (error) {
      console.error('Error creating room:', error);
      Alert.alert('Error', 'Failed to create room. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      Alert.alert('Error', 'Please enter a room code');
      return;
    }

    setLoading(true);
    try {
      const response = await axiosInstance.post('/watch/join', { roomCode });
      const room = response.data.room;
      navigation.navigate('WatchRoom', { roomCode: room.roomCode, roomId: room._id, isHost: false });
    } catch (error) {
      console.error('Error joining room:', error);
      Alert.alert('Error', 'Failed to join room. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Watch Together</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          
          <View style={[styles.card, { backgroundColor: theme.colors.card, shadowColor: theme.colors.text }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Create a Room</Text>
            <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>Host a new watch party with your partner.</Text>
            
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Enter Room Name"
              placeholderTextColor={theme.colors.textSecondary}
              value={roomName}
              onChangeText={setRoomName}
            />
            
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: theme.colors.primary }]}
              onPress={handleCreateRoom}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Room</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.dividerContainer}>
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.dividerText, { color: theme.colors.textSecondary, backgroundColor: theme.colors.background }]}>OR</Text>
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
          </View>

          <View style={[styles.card, { backgroundColor: theme.colors.card, shadowColor: theme.colors.text }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Join a Room</Text>
            <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>Enter the 6-character code to join.</Text>
            
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border, textTransform: 'uppercase' }]}
              placeholder="Enter Room Code"
              placeholderTextColor={theme.colors.textSecondary}
              value={roomCode}
              onChangeText={setRoomCode}
              autoCapitalize="characters"
              maxLength={6}
            />
            
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: theme.colors.secondary || '#4facfe' }]}
              onPress={handleJoinRoom}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Join Room</Text>}
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 24, // to balance the back button
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  cardSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
    position: 'relative',
    justifyContent: 'center',
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    position: 'absolute',
    paddingHorizontal: 15,
    fontSize: 14,
    fontWeight: 'bold',
  }
});

export default WatchLobbyScreen;
