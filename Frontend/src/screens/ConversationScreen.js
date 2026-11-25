import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  ActivityIndicator,
  Image,
  Platform,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { Audio, Video } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useThemeContext } from '../context/ThemeContext';
import axiosInstance, { getMediaUrl } from '../api/axiosConfig';
import Toast from 'react-native-toast-message';

const getMessageMediaType = (item) => {
  if (item.audioUrl || item.mediaType === 'audio') return 'audio';
  if (item.mediaType && item.mediaType !== 'none') return item.mediaType;
  if (item.mediaUrl) {
    if (item.mediaUrl.startsWith('data:image') || /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(item.mediaUrl)) {
      return 'image';
    }
    if (/\.(mp4|mov|mkv|avi|webm)(\?.*)?$/i.test(item.mediaUrl)) {
      return 'video';
    }
    return 'file';
  }
  return 'none';
};

export default function ConversationScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { socket, sendNotification } = useSocket();
  const { theme } = useThemeContext();
  const { partner } = route.params;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sound, setSound] = useState(null);
  const [playingMessageId, setPlayingMessageId] = useState(null);

  // Attachment & Action Menus
  const [attachModalVisible, setAttachModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  const flatListRef = useRef();

  const partnerId = typeof user?.partner === 'object' ? user?.partner?._id : user?.partner || partner?._id;
  const pairRoom = user?._id && partnerId ? [user._id, partnerId].sort().join('_') : null;

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
      setMessages((prev) => {
        if (prev.some((m) => m._id === newMessage._id)) return prev;
        return [...prev, newMessage];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    };

    const handleDeleteEveryone = ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? {
                ...m,
                deletedForEveryone: true,
                text: '',
                mediaUrl: '',
                audioUrl: '',
                mediaType: 'none',
                fileName: '',
              }
            : m
        )
      );
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('receive_delete_message_everyone', handleDeleteEveryone);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('receive_delete_message_everyone', handleDeleteEveryone);
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

      if (socket && pairRoom) {
        socket.emit('send_message', { room: pairRoom, message: newMessage });
      }
    } catch (error) {
      console.log('Error sending message:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to send message' });
      if (!overrideData) setInputText(textToSend);
    }
  };

  const uploadAndSendAttachment = async ({ uri, name, mimeType, mediaType }) => {
    setIsUploadingMedia(true);
    try {
      let fileUri = uri;
      const safeName = name || `file_${Date.now()}`;
      const ext = safeName.includes('.') ? safeName.split('.').pop() : mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : 'bin';

      if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
        const tempUri = `${FileSystem.cacheDirectory}chat_attach_${Date.now()}.${ext}`;
        await FileSystem.copyAsync({ from: fileUri, to: tempUri });
        fileUri = tempUri;
      } else if (Platform.OS === 'ios') {
        fileUri = fileUri.replace('file://', '');
      }

      const formData = new FormData();
      formData.append('media', {
        uri: fileUri,
        name: safeName.includes('.') ? safeName : `${safeName}.${ext}`,
        type: mimeType || 'application/octet-stream',
      });

      const uploadRes = await axiosInstance.post('/upload', formData, {
        headers: { Accept: 'application/json' },
      });

      await sendMessage({
        mediaUrl: uploadRes.data.url,
        mediaType,
        fileName: safeName,
      });
    } catch (error) {
      console.log('Attachment upload error:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: error.response?.data?.message || 'Could not send file. Supported: images, videos, PDF, docs, audio.',
      });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handlePickPhoto = async () => {
    setAttachModalVisible(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Toast.show({ type: 'error', text1: 'Permission Required', text2: 'Gallery permission is required.' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        await uploadAndSendAttachment({
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
          mediaType: 'image',
        });
      }
    } catch (err) {
      console.log('Pick photo error:', err);
    }
  };

  const handlePickVideo = async () => {
    setAttachModalVisible(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Toast.show({ type: 'error', text1: 'Permission Required', text2: 'Gallery permission is required.' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        await uploadAndSendAttachment({
          uri: asset.uri,
          name: asset.fileName || `video_${Date.now()}.mp4`,
          mimeType: asset.mimeType || 'video/mp4',
          mediaType: 'video',
        });
      }
    } catch (err) {
      console.log('Pick video error:', err);
    }
  };

  const handlePickDocument = async () => {
    setAttachModalVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        const fileName = asset.name || `document_${Date.now()}`;
        const lower = fileName.toLowerCase();
        let detectedType = 'file';
        if (/\.(jpg|jpeg|png|gif|webp)$/.test(lower)) detectedType = 'image';
        else if (/\.(mp4|mov|mkv|avi|webm)$/.test(lower)) detectedType = 'video';
        else if (/\.(mp3|wav|m4a|aac|ogg)$/.test(lower)) detectedType = 'audio';

        await uploadAndSendAttachment({
          uri: asset.uri,
          name: fileName,
          mimeType: asset.mimeType || 'application/octet-stream',
          mediaType: detectedType,
        });
      }
    } catch (err) {
      console.log('Pick document error:', err);
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
          type: `audio/${ext === 'm4a' ? 'mp4' : ext}`,
        });
        const uploadRes = await axiosInstance.post('/upload', formData, {
          headers: { Accept: 'application/json' },
        });
        await sendMessage({ audioUrl: uploadRes.data.url, mediaType: 'audio', fileName: `voicenote.${ext}` });
      }
    } catch (err) {
      console.error('Failed to upload audio', err);
      setRecording(null);
      Toast.show({ type: 'error', text1: 'Upload Failed', text2: 'Could not send voice note.' });
    }
  };

  const playAudio = async (item) => {
    try {
      if (playingMessageId === item._id && sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
        setPlayingMessageId(null);
        return;
      }
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });
      const audioSrc = getMediaUrl(item.audioUrl || item.mediaUrl);
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: audioSrc }, { shouldPlay: true });
      setSound(newSound);
      setPlayingMessageId(item._id);
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setPlayingMessageId(null);
          newSound.unloadAsync().catch(() => {});
          setSound(null);
        }
      });
    } catch (err) {
      console.error('Error playing audio', err);
      Toast.show({ type: 'error', text1: 'Playback Error', text2: 'Could not play audio.' });
    }
  };

  // --- MESSAGE & FILE ACTIONS ---
  const handleSaveToDevice = async (msg) => {
    const rawUrl = msg.mediaUrl || msg.audioUrl;
    if (!rawUrl) return;
    setActionLoading(true);
    try {
      const mType = getMessageMediaType(msg);
      const extFromName = msg.fileName && msg.fileName.includes('.') ? msg.fileName.split('.').pop() : null;
      const ext = extFromName || (mType === 'image' ? 'jpg' : mType === 'video' ? 'mp4' : mType === 'audio' ? 'm4a' : 'bin');
      const localUri = `${FileSystem.documentDirectory}HandS_Saved_${Date.now()}.${ext}`;

      if (rawUrl.startsWith('data:')) {
        const base64Data = rawUrl.split(',')[1];
        await FileSystem.writeAsStringAsync(localUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
      } else {
        const resolved = getMediaUrl(rawUrl);
        const dl = await FileSystem.downloadAsync(resolved, localUri);
        if (dl.status !== 200) throw new Error('Download failed');
      }

      if (mType === 'image' || mType === 'video') {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.saveToLibraryAsync(localUri);
          Toast.show({ type: 'success', text1: 'Saved!', text2: 'Saved to your phone gallery.' });
        } else if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(localUri);
        } else {
          Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Allow media permission to save.' });
        }
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(localUri);
        } else {
          Toast.show({ type: 'success', text1: 'Saved!', text2: 'File saved to device storage.' });
        }
      }
      setSelectedMessage(null);
    } catch (error) {
      console.log('Save error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not save file.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyMessage = async (msg) => {
    try {
      const copyValue = msg.mediaUrl
        ? getMediaUrl(msg.mediaUrl)
        : msg.audioUrl
        ? getMediaUrl(msg.audioUrl)
        : msg.text || '';
      if (!copyValue) return;
      await Clipboard.setStringAsync(copyValue);
      setSelectedMessage(null);
      Toast.show({
        type: 'success',
        text1: 'Copied!',
        text2: msg.mediaUrl || msg.audioUrl ? 'File link copied to clipboard.' : 'Message copied to clipboard.',
      });
    } catch (error) {
      console.log('Copy error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to copy.' });
    }
  };

  const handleAddToGallery = async (msg) => {
    const rawUrl = msg.mediaUrl || msg.audioUrl;
    if (!rawUrl) return;
    setActionLoading(true);
    try {
      const mType = getMessageMediaType(msg);
      const postMediaType = mType === 'video' ? 'video' : mType === 'image' ? 'image' : 'file';
      await axiosInstance.post('/posts', {
        content: msg.text || (postMediaType === 'file' ? msg.fileName || 'Shared from Chat' : ''),
        mediaUrl: rawUrl,
        mediaType: postMediaType,
      });
      sendNotification('Added to Gallery! 📸', `${user?.username || 'Your partner'} added a shared memory to Gallery.`);
      setSelectedMessage(null);
      Toast.show({ type: 'success', text1: 'Added to Gallery!', text2: 'Saved to your shared HandS Gallery.' });
    } catch (error) {
      console.log('Add to gallery error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not add to Gallery.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteForMe = async (msg) => {
    setActionLoading(true);
    try {
      await axiosInstance.delete(`/messages/${msg._id}?scope=me`);
      setMessages((prev) => prev.filter((m) => m._id !== msg._id));
      setSelectedMessage(null);
      Toast.show({ type: 'success', text1: 'Deleted', text2: 'Removed from your chat.' });
    } catch (error) {
      console.log('Delete for me error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not delete message.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteForEveryone = (msg) => {
    Alert.alert('Delete for Everyone', 'This will remove the message/file for both you and your partner.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete for Everyone',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await axiosInstance.delete(`/messages/${msg._id}?scope=everyone`);
            setMessages((prev) =>
              prev.map((m) =>
                m._id === msg._id
                  ? {
                      ...m,
                      deletedForEveryone: true,
                      text: '',
                      mediaUrl: '',
                      audioUrl: '',
                      mediaType: 'none',
                      fileName: '',
                    }
                  : m
              )
            );
            if (socket && pairRoom) {
              socket.emit('delete_message_everyone', { room: pairRoom, messageId: msg._id });
            }
            setSelectedMessage(null);
            Toast.show({ type: 'success', text1: 'Deleted', text2: 'Deleted for everyone.' });
          } catch (error) {
            console.log('Delete for everyone error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Could not delete for everyone.' });
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const isSelectedFromMe = selectedMessage && String(selectedMessage.sender) === String(user?._id);
  const selectedHasFile = selectedMessage && !selectedMessage.deletedForEveryone && !!(selectedMessage.mediaUrl || selectedMessage.audioUrl);

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
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
            {partner?.fullName || partner?.username}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isMe = String(item.sender) === String(user?._id);
              const date = new Date(item.createdAt);
              const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const mType = getMessageMediaType(item);
              const hasAttachment = !item.deletedForEveryone && !!(item.mediaUrl || item.audioUrl);

              return (
                <View style={[styles.messageBubbleWrapper, isMe ? styles.messageBubbleWrapperRight : styles.messageBubbleWrapperLeft]}>
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onLongPress={() => setSelectedMessage(item)}
                    onPress={() => {
                      if (item.deletedForEveryone) return;
                      if (mType === 'image' && item.mediaUrl) {
                        setPreviewImageUrl(getMediaUrl(item.mediaUrl));
                      } else if (mType === 'file' && item.mediaUrl) {
                        Linking.openURL(getMediaUrl(item.mediaUrl)).catch(() =>
                          Toast.show({ type: 'error', text1: 'Could not open file' })
                        );
                      }
                    }}
                    style={[
                      styles.messageBubble,
                      isMe ? styles.messageBubbleMe : [styles.messageBubblePartner, { backgroundColor: theme.colors.inputBackground }],
                      (mType === 'image' || mType === 'video') && !item.deletedForEveryone && { padding: 6 },
                    ]}
                  >
                    {item.deletedForEveryone ? (
                      <View style={styles.deletedRow}>
                        <Ionicons name="ban-outline" size={15} color={isMe ? 'rgba(255,255,255,0.85)' : theme.colors.textSecondary} />
                        <Text
                          style={[
                            styles.deletedText,
                            { color: isMe ? 'rgba(255,255,255,0.85)' : theme.colors.textSecondary },
                          ]}
                        >
                          This message was deleted
                        </Text>
                      </View>
                    ) : mType === 'audio' ? (
                      <TouchableOpacity style={styles.audioBubble} onPress={() => playAudio(item)} onLongPress={() => setSelectedMessage(item)}>
                        <Ionicons
                          name={playingMessageId === item._id ? 'stop-circle' : 'play-circle'}
                          size={28}
                          color={isMe ? '#fff' : '#ff6b81'}
                        />
                        <Text
                          style={[
                            styles.messageText,
                            isMe ? styles.messageTextMe : { color: theme.colors.text },
                            { marginLeft: 8, fontWeight: '600' },
                          ]}
                        >
                          {playingMessageId === item._id ? 'Playing...' : item.fileName && !item.fileName.startsWith('voicenote') ? item.fileName : 'Voice Note'}
                        </Text>
                      </TouchableOpacity>
                    ) : mType === 'image' && item.mediaUrl ? (
                      <Image source={{ uri: getMediaUrl(item.mediaUrl) }} style={styles.chatImage} resizeMode="cover" />
                    ) : mType === 'video' && item.mediaUrl ? (
                      <View style={styles.chatVideoWrapper}>
                        <Video
                          source={{ uri: getMediaUrl(item.mediaUrl) }}
                          style={styles.chatVideo}
                          useNativeControls
                          resizeMode="contain"
                        />
                      </View>
                    ) : mType === 'file' && item.mediaUrl ? (
                      <View style={styles.fileCardRow}>
                        <Ionicons name="document-attach" size={26} color={isMe ? '#fff' : theme.colors.primary} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text
                            style={[styles.fileNameText, isMe ? styles.messageTextMe : { color: theme.colors.text }]}
                            numberOfLines={1}
                          >
                            {item.fileName || item.mediaUrl.split('/').pop() || 'Shared File'}
                          </Text>
                          <Text style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.8)' : theme.colors.textSecondary }}>
                            Tap to open • Tap ⋯ for options
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={[styles.messageText, isMe ? styles.messageTextMe : { color: theme.colors.text }]}>
                        {item.text}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <View style={[styles.metaRow, isMe && { justifyContent: 'flex-end' }]}>
                    <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>{timeString}</Text>
                    {hasAttachment && (
                      <TouchableOpacity
                        style={styles.optionsPill}
                        onPress={() => setSelectedMessage(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}

        {isUploadingMedia && (
          <View style={[styles.uploadingBar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.uploadingText, { color: theme.colors.textSecondary }]}>Uploading attachment...</Text>
          </View>
        )}

        <View style={[styles.inputContainer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.attachButton, { backgroundColor: theme.colors.inputBackground }]}
            onPress={() => setAttachModalVisible(true)}
            disabled={isUploadingMedia || isRecording}
          >
            <Ionicons name="attach" size={22} color={theme.colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={[
              styles.textInput,
              { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border },
            ]}
            placeholder={isRecording ? 'Recording voice note... Release to send' : 'Type a message...'}
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
              disabled={isUploadingMedia}
            >
              <Ionicons name="mic" size={20} color="#ffffff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.sendButton}
              onPress={() => sendMessage()}
              activeOpacity={0.8}
              disabled={isUploadingMedia}
            >
              <Ionicons name="send" size={20} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Attach Picker Modal */}
      <Modal visible={attachModalVisible} transparent animationType="slide" onRequestClose={() => setAttachModalVisible(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setAttachModalVisible(false)}>
          <View style={[styles.sheetContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Attach from Device</Text>

            <View style={styles.attachGrid}>
              <TouchableOpacity style={[styles.attachOptionCard, { backgroundColor: theme.colors.inputBackground }]} onPress={handlePickPhoto}>
                <View style={[styles.attachIconCircle, { backgroundColor: 'rgba(255, 107, 129, 0.16)' }]}>
                  <Ionicons name="image" size={26} color="#ff6b81" />
                </View>
                <Text style={[styles.attachOptionLabel, { color: theme.colors.text }]}>Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.attachOptionCard, { backgroundColor: theme.colors.inputBackground }]} onPress={handlePickVideo}>
                <View style={[styles.attachIconCircle, { backgroundColor: 'rgba(69, 170, 242, 0.16)' }]}>
                  <Ionicons name="videocam" size={26} color="#45aaf2" />
                </View>
                <Text style={[styles.attachOptionLabel, { color: theme.colors.text }]}>Video</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.attachOptionCard, { backgroundColor: theme.colors.inputBackground }]} onPress={handlePickDocument}>
                <View style={[styles.attachIconCircle, { backgroundColor: 'rgba(43, 203, 186, 0.16)' }]}>
                  <Ionicons name="document-text" size={26} color="#2bcbba" />
                </View>
                <Text style={[styles.attachOptionLabel, { color: theme.colors.text }]}>Document</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Message / File Options Modal */}
      <Modal visible={!!selectedMessage} transparent animationType="slide" onRequestClose={() => setSelectedMessage(null)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => !actionLoading && setSelectedMessage(null)}>
          <View style={[styles.sheetContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
              {selectedHasFile ? 'File Options' : 'Message Options'}
            </Text>

            {actionLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : selectedMessage ? (
              <View>
                {/* Partner (receiver) gets Save option on shared files */}
                {!isSelectedFromMe && selectedHasFile && (
                  <TouchableOpacity style={styles.actionRow} onPress={() => handleSaveToDevice(selectedMessage)}>
                    <Ionicons name="download-outline" size={22} color={theme.colors.primary} />
                    <Text style={[styles.actionRowText, { color: theme.colors.text }]}>Save</Text>
                  </TouchableOpacity>
                )}

                {/* Both Partner & Sender get Copy */}
                {!selectedMessage.deletedForEveryone && (
                  <TouchableOpacity style={styles.actionRow} onPress={() => handleCopyMessage(selectedMessage)}>
                    <Ionicons name="copy-outline" size={22} color={theme.colors.text} />
                    <Text style={[styles.actionRowText, { color: theme.colors.text }]}>Copy</Text>
                  </TouchableOpacity>
                )}

                {/* Both Partner & Sender get Add to Gallery on shared files */}
                {selectedHasFile && (
                  <TouchableOpacity style={styles.actionRow} onPress={() => handleAddToGallery(selectedMessage)}>
                    <Ionicons name="images-outline" size={22} color="#45aaf2" />
                    <Text style={[styles.actionRowText, { color: theme.colors.text }]}>Add to Gallery</Text>
                  </TouchableOpacity>
                )}

                {/* Both Partner & Sender get Delete for me */}
                <TouchableOpacity style={styles.actionRow} onPress={() => handleDeleteForMe(selectedMessage)}>
                  <Ionicons name="trash-outline" size={22} color="#ff4757" />
                  <Text style={[styles.actionRowText, { color: '#ff4757' }]}>Delete for me</Text>
                </TouchableOpacity>

                {/* Only Sender gets Delete for Everyone */}
                {isSelectedFromMe && !selectedMessage.deletedForEveryone && (
                  <TouchableOpacity style={styles.actionRow} onPress={() => handleDeleteForEveryone(selectedMessage)}>
                    <Ionicons name="trash-bin-outline" size={22} color="#ff4757" />
                    <Text style={[styles.actionRowText, { color: '#ff4757', fontWeight: '700' }]}>Delete for Everyone</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Fullscreen Image Preview Modal */}
      <Modal visible={!!previewImageUrl} transparent animationType="fade" onRequestClose={() => setPreviewImageUrl(null)}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setPreviewImageUrl(null)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {previewImageUrl && (
            <Image source={{ uri: previewImageUrl }} style={styles.previewFullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageBubbleWrapper: {
    marginBottom: 14,
    maxWidth: '82%',
  },
  messageBubbleWrapperLeft: {
    alignSelf: 'flex-start',
  },
  messageBubbleWrapperRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageBubble: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 18,
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
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  chatImage: {
    width: 220,
    height: 220,
    borderRadius: 14,
  },
  chatVideoWrapper: {
    width: 230,
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  chatVideo: {
    width: '100%',
    height: '100%',
  },
  fileCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 190,
    maxWidth: 250,
    paddingVertical: 4,
  },
  fileNameText: {
    fontSize: 14,
    fontWeight: '700',
  },
  deletedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deletedText: {
    fontStyle: 'italic',
    fontSize: 14,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextMe: {
    color: '#ffffff',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 11,
    marginHorizontal: 4,
  },
  optionsPill: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  uploadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  uploadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  attachButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    fontSize: 15,
    borderWidth: 1,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ff6b81',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 2,
    shadowColor: '#ff6b81',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  attachGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  attachOptionCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  attachOptionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 14,
  },
  actionRowText: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  previewFullImage: {
    width: '100%',
    height: '82%',
  },
});
