import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import axiosInstance, { STATIC_URL } from '../api/axiosConfig';
import Toast from 'react-native-toast-message';

export default function ConversationScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { partner } = route.params;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef();

  useEffect(() => {
    fetchMessages();
  }, []);

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

  const sendMessage = async () => {
    if (inputText.trim() === '') return;
    
    const textToSend = inputText;
    setInputText(''); // optimistic clear
    
    try {
      const response = await axiosInstance.post('/messages', { text: textToSend });
      const newMessage = response.data;
      
      setMessages((prev) => [...prev, newMessage]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      // Emit to socket room (the room is joining in SocketContext)
      if (socket && user?.partner) {
        const room = [user._id, user.partner].sort().join('_');
        socket.emit('send_message', { room, message: newMessage });
      }
    } catch (error) {
      console.log('Error sending message:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to send message' });
      setInputText(textToSend); // revert on failure
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={[styles.avatarPlaceholder, { overflow: 'hidden' }]}>
            {partner.avatar ? (
              <Image source={{ uri: `${STATIC_URL}${partner.avatar}` }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
            ) : (
              <Text style={styles.avatarLetter}>{partner.username.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.title}>{partner.username}</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#ff6b81" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item._id}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isMe = item.sender === user._id;
              const date = new Date(item.createdAt);
              const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              return (
                <View style={[styles.messageBubbleWrapper, isMe ? styles.messageBubbleWrapperRight : styles.messageBubbleWrapperLeft]}>
                  <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubblePartner]}>
                    <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextPartner]}>
                      {item.text}
                    </Text>
                  </View>
                  <Text style={styles.timeText}>{timeString}</Text>
                </View>
              );
            }}
          />
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#aaa"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, inputText.trim() === '' && styles.sendButtonDisabled]} 
            onPress={sendMessage}
            activeOpacity={0.8}
            disabled={inputText.trim() === ''}
          >
            <Ionicons name="send" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
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
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
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
    backgroundColor: '#f1f3f5',
    borderBottomLeftRadius: 4,
  },
  messageBubbleMe: {
    backgroundColor: '#ff6b81',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextPartner: {
    color: '#1a1a1a',
  },
  messageTextMe: {
    color: '#ffffff',
  },
  timeText: {
    fontSize: 12,
    color: '#888',
    marginHorizontal: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 100,
    fontSize: 16,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#eee',
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
  sendButtonDisabled: {
    backgroundColor: '#ffb3c1',
    shadowOpacity: 0,
    elevation: 0,
  }
});
