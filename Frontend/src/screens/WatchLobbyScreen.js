import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance from '../api/axiosConfig';
import { useThemeContext } from '../context/ThemeContext';

const WatchLobbyScreen = () => {
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loadingModalVisible, setLoadingModalVisible] = useState(false);
  const [loadingPhaseText, setLoadingPhaseText] = useState('Plz wait room is creating...');
  const [loadingProgress, setLoadingProgress] = useState(25);

  const navigation = useNavigation();
  const { theme } = useThemeContext();

  const handleCreateRoom = async () => {
    try {
      if (!roomName.trim()) {
        Alert.alert('Error', 'Please enter a room name');
        return;
      }
      
      setLoadingModalVisible(true);
      setLoadingPhaseText('Plz wait room is creating...');
      setLoadingProgress(30);
      
      const response = await axiosInstance.post('/watch/create', { roomName: roomName.trim() });
      const room = response?.data?.room;
      
      if (!room || !room.roomCode || !room._id) {
        throw new Error('Invalid room data received from server');
      }

      setLoadingPhaseText('Engine is starting.....');
      setLoadingProgress(70);

      await new Promise(res => setTimeout(res, 700));

      setLoadingPhaseText('100% Ready!');
      setLoadingProgress(100);

      await new Promise(res => setTimeout(res, 400));

      setLoadingModalVisible(false);
      navigation.navigate('WatchRoom', {
        roomCode: room.roomCode,
        roomId: room._id,
        initialRoomData: room,
        isHost: true
      });
    } catch (error) {
      console.error('Error in handleCreateRoom:', error);
      setLoadingModalVisible(false);
      Alert.alert('Error', error.response?.data?.message || error.message || 'An unexpected error occurred during room creation');
    }
  };

  const handleJoinRoom = async () => {
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) {
      Alert.alert('Error', 'Please enter a room code');
      return;
    }

    try {
      setLoadingModalVisible(true);
      setLoadingPhaseText('Connecting to room...');
      setLoadingProgress(35);

      const response = await axiosInstance.post('/watch/join', { roomCode: cleanCode });
      const room = response?.data?.room;

      if (!room || !room.roomCode) {
        throw new Error('Room not found');
      }

      setLoadingPhaseText('Engine is starting.....');
      setLoadingProgress(75);

      await new Promise(res => setTimeout(res, 600));

      setLoadingPhaseText('100% Ready!');
      setLoadingProgress(100);

      await new Promise(res => setTimeout(res, 400));

      setLoadingModalVisible(false);
      navigation.navigate('WatchRoom', {
        roomCode: room.roomCode,
        roomId: room._id,
        initialRoomData: room,
        isHost: false
      });
    } catch (error) {
      console.error('Error joining room:', error);
      setLoadingModalVisible(false);
      Alert.alert('Error', error.response?.data?.message || 'Failed to join room. Check the code and try again.');
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
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.text }]}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="film-outline" size={24} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Create a Room</Text>
            </View>
            <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>Host a new watch party with your partner.</Text>
            
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Enter Room Name (e.g. Movie Night)"
              placeholderTextColor={theme.colors.textSecondary}
              value={roomName}
              onChangeText={setRoomName}
            />
            
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: theme.colors.primary }]}
              onPress={handleCreateRoom}
              disabled={loadingModalVisible}
            >
              <Text style={styles.buttonText}>Create Room</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerContainer}>
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.dividerText, { color: theme.colors.textSecondary, backgroundColor: theme.colors.background }]}>OR</Text>
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
          </View>

          <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.text }]}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="enter-outline" size={24} color="#45aaf2" style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Join a Room</Text>
            </View>
            <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>Enter the 6-character code shared by your partner.</Text>
            
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Enter 6-Digit Room Code"
              placeholderTextColor={theme.colors.textSecondary}
              value={roomCode}
              onChangeText={(val) => setRoomCode(val.toUpperCase())}
              autoCapitalize="characters"
              maxLength={6}
            />
            
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#45aaf2' }]}
              onPress={handleJoinRoom}
              disabled={loadingModalVisible}
            >
              <Text style={styles.buttonText}>Join Room</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Multi-Phase Loading Overlay (Inline View instead of native Modal to prevent Android window transition crash) */}
      {loadingModalVisible && (
        <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
          <View style={[styles.loadingBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 16 }} />
            <Text style={[styles.loadingText, { color: theme.colors.text }]}>{loadingPhaseText}</Text>
            
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${loadingProgress}%`, backgroundColor: theme.colors.primary }]} />
            </View>
            <Text style={[styles.progressPercent, { color: theme.colors.textSecondary }]}>{loadingProgress}%</Text>
          </View>
        </View>
      )}
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
    width: 24,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
    marginVertical: 28,
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
  },
  loadingOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 999,
  },
  loadingBox: {
    width: '85%',
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  loadingText: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.25)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default WatchLobbyScreen;
