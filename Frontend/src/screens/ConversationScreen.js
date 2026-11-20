import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, ActivityIndicator, Image, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useThemeContext } from '../context/ThemeContext';
import axiosInstance, { getMediaUrl } from '../api/axiosConfig';
import Toast from 'react-native-toast-message';

export default function ConversationScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { theme } = useThemeContext();
  const { partner } = route.params;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sound, setSound] = useState(null);
  const flatListRef = useRef();

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    };

    socket.on('receive_message', handleReceiveMessage);
    
    return () => {
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [socket]);

  const fetchMessages = async () => {
    try {
      const response = await axiosInstance.get('/messages');
      setMessages(response.data);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (error) {
      console.log('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (overrideData = null) => {
    if (!overrideData && inputText.trim() === '') return;
    
    const textToSend = overrideData ? '' : inputText.trim();
    if (!overrideData) setInputText('');
    
    try {
      const payload = overrideData || { text: textToSend };
      const response = await axiosInstance.post('/messages', payload);
      const newMessage = response.data;
      
      setMessages((prev) => [...prev, newMessage]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      if (socket && user?.partner) {
        const partnerId = typeof user.partner === 'object' ? user.partner._id : user.partner;
        const room = [user._id, partnerId].sort().join('_');
        socket.emit('send_message', { room, message: newMessage });
      }
    } catch (error) {
      console.log('Error sending message:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to send message' });
      if (!overrideData) setInputText(textToSend);
    }
  };

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Toast.show({ type: 'error', text1: 'Permission Required', text2: 'Microphone access is needed for voice notes.' });
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: newRec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(newRec);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        const ext = uri.split('.').pop() || 'm4a';
        const formData = new FormData();
        formData.append('media', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: `voicenote.${ext}`,
          type: `audio/${ext === 'm4a' ? 'mp4' : ext}`
        });
        const uploadRes = await axiosInstance.post('/upload', formData, {
          headers: { 'Accept': 'application/json' }
        });
        await sendMessage({ audioUrl: uploadRes.data.url });
      }
    } catch (err) {
      console.error('Failed to upload audio', err);
      setRecording(null);
      Toast.show({ type: 'error', text1: 'Upload Failed', text2: 'Could not send voice note.' });
    }
  };

  const playAudio = async (url) => {
    try {
      if (sound) await sound.unloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: getMediaUrl(url) });
      setSound(newSound);
      await newSound.playAsync();
    } catch (err) {
      console.error('Error playing audio', err);
      Toast.show({ type: 'error', text1: 'Playback Error', text2: 'Could not play voice note.' });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => navigation.navigate('PartnerProfile')}
          activeOpacity={0.8}
        >
          <View style={[styles.avatarPlaceholder, { overflow: 'hidden' }]}>
            {partner?.avatar ? (
              <Image source={{ uri: getMediaUrl(partner.avatar) }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
            ) : (
              <Text style={styles.avatarLetter}>{(partner?.username || 'P').charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>{partner?.fullName || partner?.username}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item._id}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            initialNumToRender={15}
            windowSize={5}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isMe = item.sender === user?._id;
              const date = new Date(item.createdAt);
              const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              return (
                <View style={[styles.messageBubbleWrapper, isMe ? styles.messageBubbleWrapperRight : styles.messageBubbleWrapperLeft]}>
                  <View
                    style={[
                      styles.messageBubble,
                      isMe
                        ? styles.messageBubbleMe
                        : [styles.messageBubblePartner, { backgroundColor: theme.colors.inputBackground }]
                    ]}
                  >
                    {item.audioUrl ? (
                      <TouchableOpacity style={styles.audioBubble} onPress={() => playAudio(item.audioUrl)}>
                        <Ionicons name="play-circle" size={26} color={isMe ? "#fff" : "#ff6b81"} />
                        <Text
                          style={[
                            styles.messageText,
                            isMe ? styles.messageTextMe : { color: theme.colors.text },
                            { marginLeft: 8, fontWeight: '600' }
                          ]}
                        >
                          Voice Note
                        </Text>
                      </TouchableOpacity>
                    ) : item.mediaUrl ? (
                      <Image source={{ uri: getMediaUrl(item.mediaUrl) }} style={{ width: 200, height: 200, borderRadius: 10 }} />
                    ) : (
                      <Text style={[styles.messageText, isMe ? styles.messageTextMe : { color: theme.colors.text }]}>
                        {item.text}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>{timeString}</Text>
                </View>
              );
            }}
          />
        )}

        <View style={[styles.inputContainer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholder={isRecording ? "Recording voice note... Release to send" : "Type a message..."}
            placeholderTextColor={theme.colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            editable={!isRecording}
          />
          {inputText.trim() === '' ? (
            <TouchableOpacity 
              style={[styles.sendButton, isRecording && { backgroundColor: '#ff4757' }]} 
              onPressIn={startRecording}
              onPressOut={stopRecording}
              activeOpacity={0.8}
            >
              <Ionicons name="mic" size={20} color="#ffffff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.sendButton} 
              onPress={() => sendMessage()}
              activeOpacity={0.8}
            >
              <Ionicons name="send" size={20} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ff6b81',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
  },
  messageList: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  messageBubbleWrapper: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  messageBubbleWrapperLeft: {
    alignSelf: 'flex-start',
  },
  messageBubbleWrapperRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 4,
  },
  messageBubblePartner: {
    borderBottomLeftRadius: 4,
  },
  messageBubbleMe: {
    backgroundColor: '#ff6b81',
    borderBottomRightRadius: 4,
  },
  audioBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextMe: {
    color: '#ffffff',
  },
  timeText: {
    fontSize: 12,
    marginHorizontal: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 100,
    fontSize: 16,
    borderWidth: 1,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ff6b81',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginBottom: 2,
    shadowColor: '#ff6b81',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
});
