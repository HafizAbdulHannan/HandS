import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Modal, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Share, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import axiosInstance, { STATIC_URL } from '../api/axiosConfig';
import { Ionicons } from '@expo/vector-icons';
import YoutubeIframe from 'react-native-youtube-iframe';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import FloatingEmojis from '../components/FloatingEmojis';
import createAgoraRtcEngine, { ChannelProfileType, ClientRoleType, RtcSurfaceView } from 'react-native-agora';
import { PermissionsAndroid } from 'react-native';

const AGORA_APP_ID = '32e0688e8a9840579f3282e75ea6a9ac';

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
  const [isMicOn, setIsMicOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeReaction, setActiveReaction] = useState(null);
  
  // Agora State
  const [isJoined, setIsJoined] = useState(false);
  const [remoteUids, setRemoteUids] = useState([]);
  const agoraEngineRef = useRef(null);

  const playerRef = useRef(null);
  const reactionTimeoutRef = useRef(null);

  const videoPlayer = useVideoPlayer(mediaUrl || null, player => {
    player.loop = true;
  });
  
  const videoPlayerRef = useRef(videoPlayer);
  useEffect(() => {
    videoPlayerRef.current = videoPlayer;
  }, [videoPlayer]);

  useEffect(() => {
    videoPlayerRef.current = videoPlayer;
  }, [videoPlayer]);

  // Agora Initialization
  useEffect(() => {
    const setupAgora = async () => {
      if (Platform.OS === 'android') {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.CAMERA,
        ]);
      }
      
      try {
        agoraEngineRef.current = createAgoraRtcEngine();
        const agoraEngine = agoraEngineRef.current;
        agoraEngine.initialize({ appId: AGORA_APP_ID });
        
        agoraEngine.registerEventHandler({
          onJoinChannelSuccess: () => {
            setIsJoined(true);
          },
          onUserJoined: (_connection, uid) => {
            setRemoteUids((prev) => [...prev, uid]);
          },
          onUserOffline: (_connection, uid) => {
            setRemoteUids((prev) => prev.filter((id) => id !== uid));
          },
        });

        agoraEngine.enableVideo();
        agoraEngine.enableAudio();
        // Start muted & video off
        agoraEngine.muteLocalAudioStream(true);
        agoraEngine.muteLocalVideoStream(true);

        agoraEngine.joinChannel('', roomCode, 0, {
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        });
      } catch (e) {
        console.error('Agora Error:', e);
      }
    };

    setupAgora();

    return () => {
      if (agoraEngineRef.current) {
        agoraEngineRef.current.leaveChannel();
        agoraEngineRef.current.removeAllListeners();
        agoraEngineRef.current.release();
      }
    };
  }, [roomCode]);

  useEffect(() => {
    fetchRoomDetails();
    if (socket) {
      socket.emit('join_watch_room', { roomCode });

      socket.on('receive_media_play', () => {
        setPlaying(true);
        if (videoPlayerRef.current) videoPlayerRef.current.play();
      });
      socket.on('receive_media_pause', () => {
        setPlaying(false);
        if (videoPlayerRef.current) videoPlayerRef.current.pause();
      });
      socket.on('receive_media_seek', ({ timestamp }) => {
        if (playerRef.current) {
          playerRef.current.seekTo(timestamp, true);
        }
        if (videoPlayerRef.current) {
          videoPlayerRef.current.currentTime = timestamp;
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
        if (videoPlayerRef.current) videoPlayerRef.current.pause();
      });
      socket.on('receive_kick_user', ({ userId }) => {
        if (userId === user._id) {
          Alert.alert('Kicked', 'You have been removed from the room.');
          navigation.goBack();
        }
      });
      socket.on('receive_delete_room', () => {
        Alert.alert('Room Deleted', 'The host has deleted this room.');
        navigation.goBack();
      });

      socket.on('receive_sync_media', ({ timestamp, playing: hostPlaying }) => {
        if (isHost) return;
        
        // Sync playing state
        if (hostPlaying !== playing) {
          setPlaying(hostPlaying);
          if (hostPlaying && videoPlayerRef.current) {
            videoPlayerRef.current.play();
          } else if (!hostPlaying && videoPlayerRef.current) {
            videoPlayerRef.current.pause();
          }
        }

        // Sync timestamp if out of sync by >1.5s
        const syncThreshold = 1.5;
        const checkSync = async () => {
          let localTime = 0;
          if (mediaType === 'youtube' && playerRef.current) {
            localTime = await playerRef.current.getCurrentTime();
          } else if (mediaType === 'upload' && videoPlayerRef.current) {
            localTime = videoPlayerRef.current.currentTime;
          }
          
          if (Math.abs(localTime - timestamp) > syncThreshold) {
            if (mediaType === 'youtube' && playerRef.current) {
              playerRef.current.seekTo(timestamp, true);
            } else if (mediaType === 'upload' && videoPlayerRef.current) {
              videoPlayerRef.current.currentTime = timestamp;
            }
          }
        };
        checkSync();
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
        socket.off('receive_sync_media');
        socket.off('receive_reaction');
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
    if (videoPlayer && isHost) {
      const subscription = videoPlayer.addListener('playingChange', ({ isPlaying }) => {
        if (isPlaying && !playing) {
          setPlaying(true);
          socket.emit('media_play', { roomCode, timestamp: videoPlayer.currentTime });
        } else if (!isPlaying && playing) {
          setPlaying(false);
          socket.emit('media_pause', { roomCode, timestamp: videoPlayer.currentTime });
        }
      });
      return () => {
        subscription.remove();
      };
    }
  }, [videoPlayer, isHost, playing, socket, roomCode]);

  useEffect(() => {
    let syncInterval;
    if (isHost && socket && playing) {
      syncInterval = setInterval(async () => {
        let currentTime = 0;
        if (mediaType === 'youtube' && playerRef.current) {
          currentTime = await playerRef.current.getCurrentTime();
        } else if (mediaType === 'upload' && videoPlayer) {
          currentTime = videoPlayer.currentTime;
        }
        socket.emit('sync_media', { roomCode, timestamp: currentTime, playing });
      }, 3000);
    }
    return () => clearInterval(syncInterval);
  }, [isHost, socket, playing, mediaType, videoPlayer, roomCode]);

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
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const videoAsset = result.assets[0];
        setUploading(true);

        const formData = new FormData();
        formData.append('media', {
          uri: videoAsset.uri,
          name: videoAsset.fileName || 'upload.mp4',
          type: 'video/mp4'
        });

        const res = await axiosInstance.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        const uploadedUrl = res.data;
        setMediaType('upload');
        setMediaUrl(`${STATIC_URL}${uploadedUrl}`);
        setPlaying(false);
        if (videoPlayer) videoPlayer.pause();
        
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

  const handleScreenShare = () => {
    if (!isHost) return;
    Alert.alert('Coming Soon', 'Screen Share with Agora SDK will be implemented in the next build.');
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
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
        ) : mediaType === 'upload' && mediaUrl ? (
          <View style={styles.playerWrapper}>
            <View pointerEvents={isHost ? 'auto' : 'none'} style={styles.playerInner}>
              <VideoView
                player={videoPlayer}
                style={{ width: '100%', height: '100%' }}
                allowsFullscreen
                allowsPictureInPicture
              />
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
            
            <TouchableOpacity 
              style={[styles.controlButton, { backgroundColor: theme.colors.card }]}
              onPress={handleScreenShare}
            >
              <Ionicons name="desktop-outline" size={28} color={theme.colors.text} />
              <Text style={[styles.controlButtonText, { color: theme.colors.text }]}>Share Screen</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Call Controls (For Everyone) */}
      <View style={[styles.controlsContainer, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.controlsTitle, { color: theme.colors.text }]}>Call Controls</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlsRow}>
          <TouchableOpacity 
            style={[styles.controlButton, { backgroundColor: theme.colors.card }]}
            onPress={() => {
              const newMicState = !isMicOn;
              setIsMicOn(newMicState);
              agoraEngineRef.current?.muteLocalAudioStream(!newMicState);
            }}
          >
            <Ionicons name={isMicOn ? "mic" : "mic-off"} size={24} color={isMicOn ? theme.colors.primary : "#ff4757"} />
            <Text style={[styles.controlButtonText, { color: theme.colors.text }]}>{isMicOn ? 'Mute' : 'Unmute'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, { backgroundColor: theme.colors.card }]}
            onPress={() => {
              const newVideoState = !isVideoOn;
              setIsVideoOn(newVideoState);
              agoraEngineRef.current?.muteLocalVideoStream(!newVideoState);
              if (newVideoState) {
                agoraEngineRef.current?.startPreview();
              } else {
                agoraEngineRef.current?.stopPreview();
              }
            }}
          >
            <Ionicons name={isVideoOn ? "videocam" : "videocam-off"} size={24} color={isVideoOn ? theme.colors.primary : "#ff4757"} />
            <Text style={[styles.controlButtonText, { color: theme.colors.text }]}>{isVideoOn ? 'Stop Video' : 'Start Video'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

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
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Participants & Cameras</Text>
        
        {/* Remote Users Videos */}
        {remoteUids.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.remoteVideosScroll}>
            {remoteUids.map((uid) => (
              <View key={uid} style={[styles.remoteVideoContainer, { borderColor: theme.colors.primary }]}>
                <RtcSurfaceView canvas={{ uid }} style={styles.agoraVideoView} />
                <View style={styles.localVideoLabel}>
                  <Text style={styles.localVideoLabelText}>User {uid}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <ScrollView 
          style={styles.participantsList} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
        >
          {roomData && roomData.participants.map(p => (
            <View key={p._id} style={[styles.participantRow, { backgroundColor: theme.colors.card }]}>
              <View style={styles.participantInfo}>
                <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.avatarText}>
                    {p.name ? p.name.charAt(0).toUpperCase() : p.email.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.participantName, { color: theme.colors.text }]}>
                  {p.name || p.email} {p._id === roomData.host._id ? '(Host)' : ''}
                </Text>
              </View>
              
              {isHost && p._id !== user._id && (
                <TouchableOpacity 
                  style={styles.kickButton}
                  onPress={() => {
                    socket.emit('kick_user', { roomCode, userId: p._id });
                    Alert.alert('Kicked', 'User has been kicked.');
                  }}
                >
                  <Ionicons name="person-remove-outline" size={20} color="#ff4757" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Local Video Camera */}
      {isVideoOn && isJoined && (
        <View style={[styles.localVideoContainer, { borderColor: theme.colors.primary, overflow: 'hidden', backgroundColor: '#000' }]}>
          <RtcSurfaceView canvas={{ uid: 0 }} style={styles.agoraVideoView} />
          <View style={styles.localVideoLabel}>
            <Text style={styles.localVideoLabelText}>You</Text>
          </View>
        </View>
      )}

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
              <Ionicons name="person-add-outline" size={22} color={theme.colors.primary} style={{ marginRight: 10 }} />
              <Text style={[styles.settingsActionText, { color: theme.colors.text }]}>Share Code / Add Participant</Text>
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
  localVideoContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 100,
    height: 150,
    backgroundColor: '#333',
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
  remoteVideosScroll: {
    marginBottom: 15,
  },
  remoteVideoContainer: {
    width: 100,
    height: 150,
    backgroundColor: '#000',
    borderRadius: 12,
    borderWidth: 2,
    marginRight: 10,
    overflow: 'hidden',
    position: 'relative',
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
