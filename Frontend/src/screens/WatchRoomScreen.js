import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Modal, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Share, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import axiosInstance, { STATIC_URL, getMediaUrl } from '../api/axiosConfig';
import { Ionicons } from '@expo/vector-icons';
import YoutubeIframe from 'react-native-youtube-iframe';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import FloatingEmojis from '../components/FloatingEmojis';
import Toast from 'react-native-toast-message';
import { PermissionsAndroid, NativeModules } from 'react-native';
import Constants, { AppOwnership } from 'expo-constants';





const WatchRoomScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { socket } = useSocket();
  const { user } = useAuth();
  const { theme } = useThemeContext();
  const { roomCode, roomId, isHost } = route.params;

  const [roomData, setRoomData] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [mediaType, setMediaType] = useState('none');
  const [mediaUrl, setMediaUrl] = useState('');
  const [youtubeId, setYoutubeId] = useState('');
  
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [ytInput, setYtInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isHostUploading, setIsHostUploading] = useState(false);
        const [refreshing, setRefreshing] = useState(false);
  const [activeReaction, setActiveReaction] = useState(null);
  


  const playerRef = useRef(null);
  const reactionTimeoutRef = useRef(null);
  const videoPlayerRef = useRef(null);



  useEffect(() => {
    fetchRoomDetails();
    if (socket) {
      socket.emit('join_watch_room', { roomCode });

      socket.on('receive_media_play', () => {
        setPlaying(true);
        if (videoPlayerRef.current) videoPlayerRef.current.playAsync();
      });
      socket.on('receive_media_pause', () => {
        setPlaying(false);
        if (videoPlayerRef.current) videoPlayerRef.current.pauseAsync();
      });
      socket.on('receive_media_seek', ({ timestamp }) => {
        if (mediaType === 'youtube' && playerRef.current) {
          playerRef.current.seekTo(timestamp, true);
        } else if (mediaType === 'upload' && videoPlayerRef.current) {
          videoPlayerRef.current.setPositionAsync(timestamp * 1000);
        }
      });
      socket.on('receive_change_media', ({ media }) => {
        setMediaType(media.type);
        if (media.type === 'youtube') {
          setYoutubeId(extractYoutubeId(media.url));
        } else if (media.type === 'upload') {
          setMediaUrl(`${STATIC_URL}${media.url}`);
        }
        setPlaying(false);
        if (videoPlayerRef.current) videoPlayerRef.current.pauseAsync();
      });
      socket.on('receive_kick_user', ({ userId }) => {
        if (userId === user._id) {
          Alert.alert('Disconnected', 'The host has ended the watch party.');
          navigation.goBack();
        }
      });
      socket.on('receive_delete_room', () => {
        Alert.alert('Room Deleted', 'The host has deleted this room.');
        navigation.goBack();
      });

      socket.on('receive_media_uploading', ({ progress }) => {
        if (progress < 100) {
          setIsHostUploading(true);
          setUploadProgress(progress);
        } else {
          setIsHostUploading(false);
          setUploadProgress(0);
        }
      });

      socket.on('watch_invite_accepted', ({ guestName }) => {
        Toast.show({ type: 'success', text1: `${guestName} accepted your invite!`, position: 'top' });
      });

      socket.on('watch_invite_rejected', ({ guestName }) => {
        Toast.show({ type: 'error', text1: `${guestName} declined your invite.`, position: 'top' });
      });

      socket.on('receive_sync_media', async ({ timestamp, playing: hostPlaying }) => {
        if (hostPlaying !== playing) {
          setPlaying(hostPlaying);
          if (hostPlaying && videoPlayerRef.current) {
            videoPlayerRef.current.playAsync();
          } else if (!hostPlaying && videoPlayerRef.current) {
            videoPlayerRef.current.pauseAsync();
          }
        }
        
        // Only seek if the difference is more than 2 seconds to avoid stutter
        let localTime = 0;
        try {
          if (mediaType === 'youtube' && playerRef.current) {
            localTime = await playerRef.current.getCurrentTime();
          } else if (mediaType === 'upload' && videoPlayerRef.current) {
            const status = await videoPlayerRef.current.getStatusAsync();
            if (status.isLoaded) localTime = status.positionMillis / 1000;
          }
          
          if (Math.abs(localTime - timestamp) > 2) {
            if (mediaType === 'youtube' && playerRef.current) {
              playerRef.current.seekTo(timestamp, true);
            } else if (mediaType === 'upload' && videoPlayerRef.current) {
              videoPlayerRef.current.setPositionAsync(timestamp * 1000);
            }
          }
        } catch (err) {
          console.log(err);
        }
      });

      socket.on('receive_reaction', ({ reaction }) => {
        showReaction(reaction);
      });
    }

    return () => {
      if (socket) {
        socket.emit('leave_watch_room', { roomCode });
        socket.off('receive_media_play');
        socket.off('receive_media_pause');
        socket.off('receive_media_seek');
        socket.off('receive_change_media');
        socket.off('receive_kick_user');
        socket.off('receive_delete_room');
        socket.off('receive_media_uploading');
        socket.off('watch_invite_accepted');
        socket.off('watch_invite_rejected');
        socket.off('receive_sync_media');
        socket.off('receive_reaction');
      }
      if (reactionTimeoutRef.current) {
        clearTimeout(reactionTimeoutRef.current);
      }
    };
  }, []);

  const fetchRoomDetails = async () => {
    try {
      const response = await axiosInstance.get(`/watch/${roomId}`);
      setRoomData(response.data.room);
    } catch (error) {
      console.error(error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRoomDetails();
    setRefreshing(false);
  }, []);

  const extractYoutubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleChangeMedia = () => {
    const id = extractYoutubeId(ytInput);
    if (!id) {
      Alert.alert('Error', 'Invalid YouTube URL');
      return;
    }
    setYoutubeId(id);
    setMediaType('youtube');
    setPlaying(false);
    setShowMediaModal(false);
    
    if (socket) {
      socket.emit('change_media', { 
        roomCode, 
        media: { type: 'youtube', url: ytInput } 
      });
    }
  };

  const onStateChange = useCallback((state) => {
    if (!isHost) return;
    if (state === 'playing') {
      setPlaying(true);
      socket.emit('media_play', { roomCode, timestamp: 0 });
    } else if (state === 'paused') {
      setPlaying(false);
      socket.emit('media_pause', { roomCode, timestamp: 0 });
    }
  }, [isHost, socket, roomCode]);

  useEffect(() => {
    let syncInterval;
    if (isHost && socket && playing) {
      syncInterval = setInterval(async () => {
        let currentTime = 0;
        if (mediaType === 'youtube' && playerRef.current) {
          currentTime = await playerRef.current.getCurrentTime();
        } else if (mediaType === 'upload' && videoPlayerRef.current) {
          const status = await videoPlayerRef.current.getStatusAsync();
          if (status.isLoaded) currentTime = status.positionMillis / 1000;
        }
        socket.emit('sync_media', { roomCode, timestamp: currentTime, playing });
      }, 3000);
    }
    return () => clearInterval(syncInterval);
  }, [isHost, socket, playing, mediaType, roomCode]);

  const showReaction = (reaction) => {
    setActiveReaction(reaction);
    if (reactionTimeoutRef.current) {
      clearTimeout(reactionTimeoutRef.current);
    }
    reactionTimeoutRef.current = setTimeout(() => {
      setActiveReaction(null);
    }, 60000); // 1 minute reset
  };

  const handleSendReaction = (emoji) => {
    showReaction(emoji);
    if (socket) {
      socket.emit('send_reaction', { roomCode, reaction: emoji, senderName: user.name || user.email });
    }
  };

  const handleUploadVideo = async () => {
    if (!isHost) return;
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const videoAsset = result.assets[0];
        setUploading(true);

        const formData = new FormData();
        formData.append('media', {
          uri: Platform.OS === 'ios' ? videoAsset.uri.replace('file://', '') : videoAsset.uri,
          name: videoAsset.fileName || 'upload.mp4',
          type: videoAsset.mimeType || 'video/mp4'
        });

        const res = await axiosInstance.post('/upload', formData, {
          headers: { 'Accept': 'application/json' },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
            if (socket) {
              socket.emit('media_uploading', { roomCode, progress: percentCompleted });
            }
          }
        });

        const uploadedUrl = res.data.url;
        setUploadProgress(0);
        if (socket) {
          socket.emit('media_uploading', { roomCode, progress: 100 });
        }
        setMediaType('upload');
        setMediaUrl(`${STATIC_URL}${uploadedUrl}`);
        setPlaying(false);
        if (videoPlayerRef.current) videoPlayerRef.current.pauseAsync();
        
        if (socket) {
          socket.emit('change_media', { 
            roomCode, 
            media: { type: 'upload', url: uploadedUrl } 
          });
        }
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      Alert.alert('Error', 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  
  const handleDeleteRoom = () => {
    Alert.alert(
      'Delete Room',
      'Are you sure you want to delete this room? This will kick everyone out.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              if (socket) {
                socket.emit('delete_room', { roomCode });
              }
              await axiosInstance.delete(`/watch/${roomId}`);
              setShowSettingsModal(false);
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting room:', error);
              Alert.alert('Error', 'Could not delete room.');
            }
          }
        }
      ]
    );
  };

  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Join my Watch Together room on HandS! Code: ${roomCode}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddParticipant = () => {
    if (!user.partner) {
      Alert.alert('No Partner', 'You do not have a partner to invite.');
      return;
    }
    if (socket) {
      const partnerId = typeof user.partner === 'object' ? user.partner._id : user.partner;
      socket.emit('invite_partner_watch', {
        partnerId,
        roomCode,
        hostName: user.fullName || user.username || user.email
      });
      Alert.alert('Invited', 'An invite has been sent to your partner.');
    }
  };

  const handleGoBack = () => {
    if (isHost) {
      Alert.alert(
        'Leave Room',
        'Do you want to just leave, or delete the room for everyone?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Leave Only', onPress: () => {
            if (socket) socket.emit('leave_watch_room', { roomCode });
            navigation.goBack();
          }},
          { text: 'Delete Room', style: 'destructive', onPress: handleDeleteRoom }
        ]
      );
    } else {
      if (socket) socket.emit('leave_watch_room', { roomCode });
      navigation.goBack();
    }
  };

  
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      {!roomData && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 999, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ color: '#fff', marginTop: 10 }}>Entering Room...</Text>
        </View>
      )}
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {roomData ? roomData.roomName : 'Watch Room'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowSettingsModal(true)} style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Media Area */}
      <View style={[styles.mediaContainer, { backgroundColor: '#000' }]}>
        {mediaType === 'youtube' && youtubeId ? (
          <View style={styles.playerWrapper}>
            <View pointerEvents={isHost ? 'auto' : 'none'} style={styles.playerInner}>
              <YoutubeIframe
                ref={playerRef}
                height={'100%'}
                width={'100%'}
                videoId={youtubeId}
                play={playing}
                onChangeState={onStateChange}
              />
            </View>
          </View>
        ) : mediaType === 'upload' ? (
          <View style={styles.playerWrapper}>
            <View pointerEvents={isHost ? 'auto' : 'none'} style={styles.playerInner}>
              <Video
                ref={videoPlayerRef}
                source={{ uri: mediaUrl }}
                style={{ width: '100%', height: '100%' }}
                useNativeControls={isHost}
                resizeMode="contain"
                isLooping
                onPlaybackStatusUpdate={(status) => {
                  if (status.isLoaded && isHost) {
                    if (status.isPlaying && !playing) {
                      setPlaying(true);
                      socket.emit('media_play', { roomCode, timestamp: status.positionMillis / 1000 });
                    } else if (!status.isPlaying && playing) {
                      setPlaying(false);
                      socket.emit('media_pause', { roomCode, timestamp: status.positionMillis / 1000 });
                    }
                  }
                }}
              />
            </View>
          </View>
        ) : isHostUploading || uploading ? (
          <View style={styles.noMediaContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.noMediaText}>
              Host is uploading video... {uploadProgress}%
            </Text>
            <View style={{ width: '60%', height: 6, backgroundColor: '#333', marginTop: 15, borderRadius: 3 }}>
              <View style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: theme.colors.primary, borderRadius: 3 }} />
            </View>
          </View>
        ) : (
          <View style={styles.noMediaContainer}>
            <Ionicons name="film-outline" size={60} color="#666" />
            <Text style={styles.noMediaText}>Waiting for host to start media...</Text>
          </View>
        )}
      </View>

      {/* Host Controls */}
      {isHost && (
        <View style={[styles.controlsContainer, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.controlsTitle, { color: theme.colors.text }]}>Host Controls</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlsRow}>
            <TouchableOpacity 
              style={[styles.controlButton, { backgroundColor: theme.colors.card }]}
              onPress={() => setShowMediaModal(true)}
            >
              <Ionicons name="logo-youtube" size={28} color="#ff0000" />
              <Text style={[styles.controlButtonText, { color: theme.colors.text }]}>YouTube</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.controlButton, { backgroundColor: theme.colors.card }]}
              onPress={handleUploadVideo}
              disabled={uploading}
            >
              <Ionicons name="cloud-upload-outline" size={28} color={theme.colors.primary} />
              <Text style={[styles.controlButtonText, { color: theme.colors.text }]}>
                {uploading ? 'Uploading...' : 'Upload Video'}
              </Text>
            </TouchableOpacity>
            
            
          </ScrollView>
        </View>
      )}

      
      {/* Reaction Tab */}
      <View style={styles.reactionTabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactionScroll}>
          {['❤️', '😂', '😮', '👍', '🔥', '🎉'].map((emoji, index) => (
            <TouchableOpacity key={index} style={[styles.reactionButton, { backgroundColor: theme.colors.card }]} onPress={() => handleSendReaction(emoji)}>
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Participants */}
      <View style={styles.participantsSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Participants</Text>
        <ScrollView style={styles.participantsList} contentContainerStyle={{ paddingBottom: 80 }}>
          {roomData && roomData.participants.map(p => (
            <View key={p._id} style={[styles.participantRow, { backgroundColor: theme.colors.card }]}>
              <Text style={{color: theme.colors.text}}>{p.fullName || p.username}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Floating Emojis Overlay */}
      {activeReaction && <FloatingEmojis emoji={activeReaction} />}

      {/* Media Selection Modal */}
      <Modal visible={showMediaModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Play YouTube Video</Text>
              <TouchableOpacity onPress={() => setShowMediaModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
              Paste a YouTube video link below to sync playback with the room.
            </Text>
            
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.colors.card, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="https://www.youtube.com/watch?v=..."
              placeholderTextColor={theme.colors.textSecondary}
              value={ytInput}
              onChangeText={setYtInput}
            />
            
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleChangeMedia}
            >
              <Ionicons name="play" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.modalButtonText}>Play for Everyone</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Room Settings Modal */}
      <Modal visible={showSettingsModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayCentered}>
          <View style={[styles.settingsModalContent, { backgroundColor: theme.colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Room Settings</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={[styles.infoRow, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Room Name</Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>{roomData?.roomName}</Text>
            </View>
            
            <View style={[styles.infoRow, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Room Code</Text>
              <Text style={[styles.infoValue, { color: theme.colors.primary, fontWeight: 'bold' }]}>{roomCode}</Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.settingsActionBtn, { backgroundColor: theme.colors.card }]}
              onPress={handleShareCode}
            >
              <Ionicons name="share-social-outline" size={22} color={theme.colors.primary} style={{ marginRight: 10 }} />
              <Text style={[styles.settingsActionText, { color: theme.colors.text }]}>Share Code</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingsActionBtn, { backgroundColor: theme.colors.card, marginTop: 10 }]}
              onPress={handleAddParticipant}
            >
              <Ionicons name="person-add-outline" size={22} color={theme.colors.primary} style={{ marginRight: 10 }} />
              <Text style={[styles.settingsActionText, { color: theme.colors.text }]}>Add Partner</Text>
            </TouchableOpacity>

            {isHost && (
              <TouchableOpacity 
                style={[styles.settingsActionBtn, { backgroundColor: 'rgba(255, 71, 87, 0.1)', marginTop: 10 }]}
                onPress={handleDeleteRoom}
              >
                <Ionicons name="trash-outline" size={22} color="#ff4757" style={{ marginRight: 10 }} />
                <Text style={[styles.settingsActionText, { color: '#ff4757' }]}>Delete Room</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 5,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  settingsButton: {
    padding: 5,
  },
  mediaContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerWrapper: {
    width: '100%',
    height: '100%',
  },
  playerInner: {
    flex: 1,
  },
  noMediaContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMediaText: {
    color: '#888',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  controlsContainer: {
    padding: 15,
    borderBottomWidth: 1,
  },
  controlsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginRight: 15,
    flexDirection: 'row',
  },
  controlButtonText: {
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  participantsSection: {
    flex: 1,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  participantsList: {
    flex: 1,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
  },
  kickButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButton: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlayCentered: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsModalContent: {
    width: '85%',
    borderRadius: 20,
    padding: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 16,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
  },
  settingsActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  videoCallContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: '#000',
  },
  mainVideoContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  pipVideoContainer: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    width: 100,
    height: 150,
    backgroundColor: '#333',
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 999,
  },
  localVideoLabel: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 10,
  },
  localVideoLabelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  agoraVideoView: {
    width: '100%',
    height: '100%',
  },
  reactionTabContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  reactionScroll: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reactionEmoji: {
    fontSize: 22,
  },
});

export default WatchRoomScreen;
