import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Share,
  RefreshControl,
  Image,
  ActivityIndicator,
  PermissionsAndroid,
  NativeModules,
  TurboModuleRegistry,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import axiosInstance, { getMediaUrl } from '../api/axiosConfig';
import { Ionicons } from '@expo/vector-icons';
import YoutubeIframe from 'react-native-youtube-iframe';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import FloatingEmojis from '../components/FloatingEmojis';
import Toast from 'react-native-toast-message';
import Constants from 'expo-constants';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PLAYER_HEIGHT = Math.round(SCREEN_WIDTH * (9 / 16));

let createAgoraRtcEngine;
let ChannelProfileType;
let ClientRoleType;
let AudioProfileType;
let AudioScenarioType;
let VideoSourceType;
let RenderModeType;
let RtcSurfaceView;
let RtcTextureView;
let isAgoraAvailable = false;

try {
  const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
  if (!isExpoGo) {
    const hasAgoraNative =
      !!(TurboModuleRegistry && typeof TurboModuleRegistry.get === 'function' && TurboModuleRegistry.get('AgoraRtcNg')) ||
      !!NativeModules.AgoraRtcNg ||
      !!NativeModules.AgoraRtcEngineModule;

    if (hasAgoraNative) {
      const agora = require('react-native-agora');
      createAgoraRtcEngine = agora.createAgoraRtcEngine || agora.default;
      ChannelProfileType = agora.ChannelProfileType || { ChannelProfileLiveBroadcasting: 1, ChannelProfileCommunication: 0 };
      ClientRoleType = agora.ClientRoleType || { ClientRoleBroadcaster: 1, ClientRoleAudience: 2 };
      AudioProfileType = agora.AudioProfileType || { AudioProfileMusicStandard: 2, AudioProfileDefault: 0 };
      AudioScenarioType = agora.AudioScenarioType || { AudioScenarioGameStreaming: 3, AudioScenarioDefault: 0 };
      VideoSourceType = agora.VideoSourceType || { VideoSourceCameraPrimary: 0, VideoSourceScreenPrimary: 2, VideoSourceRemote: 9 };
      RenderModeType = agora.RenderModeType || { RenderModeHidden: 1, RenderModeFit: 2 };
      RtcSurfaceView = agora.RtcSurfaceView;
      RtcTextureView = agora.RtcTextureView;
      isAgoraAvailable = typeof createAgoraRtcEngine === 'function';
    }
  }
} catch (e) {
  console.warn('Failed to load react-native-agora dynamically:', e);
}

// On Android, RtcTextureView works cleanly inside ScrollView and rounded/PIP containers.
// On iOS, RtcSurfaceView is used.
const AgoraVideoView = Platform.OS === 'android' ? RtcTextureView || RtcSurfaceView : RtcSurfaceView;

const AGORA_APP_ID = '32e0688e8a9840579f3282e75ea6a9ac';
let globalAgoraEngine = null;

const getDeterministicAgoraUid = (userId) => {
  const str = String(userId || Math.random());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 900000;
  }
  return 100000 + Math.abs(hash);
};

const extractYoutubeId = (url) => {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = trimmed.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

const WatchRoomScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { socket } = useSocket();
  const { user } = useAuth();
  const { theme } = useThemeContext();

  const rawRoomCode = route.params?.roomCode || '';
  const roomCode = String(rawRoomCode).trim().toUpperCase();
  const initialRoomId = route.params?.roomId || route.params?.initialRoomData?._id || null;
  const isHost = !!route.params?.isHost;

  const myAgoraUidRef = useRef(getDeterministicAgoraUid(user?._id));

  const [roomData, setRoomData] = useState(route.params?.initialRoomData || null);
  const [currentRoomId, setCurrentRoomId] = useState(initialRoomId);
  const [isRoomLoading, setIsRoomLoading] = useState(!route.params?.initialRoomData);
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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeReaction, setActiveReaction] = useState(null);

  // Agora State
  const [isJoined, setIsJoined] = useState(false);
  const [agoraStatusText, setAgoraStatusText] = useState('Connecting...');
  const [localUid, setLocalUid] = useState(myAgoraUidRef.current);
  const [remoteUids, setRemoteUids] = useState([]);
  const [remoteVideoUids, setRemoteVideoUids] = useState([]);
  const [isPermissionsGranted, setIsPermissionsGranted] = useState(false);
  const [isEngineInitialized, setIsEngineInitialized] = useState(false);

  const agoraEngineRef = useRef(null);
  const agoraEventHandlerRef = useRef(null);
  const initialMediaLoadedRef = useRef(false);
  const isMicOnRef = useRef(false);
  const isVideoOnRef = useRef(false);
  const isScreenSharingRef = useRef(false);

  const playerRef = useRef(null);
  const reactionTimeoutRef = useRef(null);
  const videoPlayerRef = useRef(null);

  // Refs to prevent stale closures inside socket & Agora callbacks
  const mediaTypeRef = useRef(mediaType);
  const playingRef = useRef(playing);
  useEffect(() => { mediaTypeRef.current = mediaType; }, [mediaType]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);
  useEffect(() => { isVideoOnRef.current = isVideoOn; }, [isVideoOn]);
  useEffect(() => { isScreenSharingRef.current = isScreenSharing; }, [isScreenSharing]);

  const [loadingPhase, setLoadingPhase] = useState(isHost ? 3 : 0);
  const [loadingText] = useState(isHost ? 'Entering room...' : 'Connecting to room...');
  const [loadingProgress] = useState(isHost ? 100 : 60);

  const buildMediaOptions = useCallback(({ mic, camera, screen }) => ({
    channelProfile: ChannelProfileType?.ChannelProfileLiveBroadcasting ?? 1,
    clientRoleType: ClientRoleType?.ClientRoleBroadcaster ?? 1,
    publishMicrophoneTrack: !!mic,
    publishCameraTrack: !!camera && !screen,
    publishScreenCaptureVideo: !!screen,
    publishScreenCaptureAudio: !!screen,
    autoSubscribeAudio: true,
    autoSubscribeVideo: true,
  }), []);

  const applyLoudSpeakerMediaAudio = useCallback((engine) => {
    if (!engine) return;
    try {
      const musicProfile = AudioProfileType?.AudioProfileMusicStandard ?? 2;
      const gameScenario = AudioScenarioType?.AudioScenarioGameStreaming ?? 3;
      engine.setAudioProfile?.(musicProfile, gameScenario);
      engine.setAudioScenario?.(gameScenario);
      engine.setDefaultAudioRouteToSpeakerphone?.(true);
      engine.setEnableSpeakerphone?.(true);
      engine.adjustPlaybackSignalVolume?.(130);
      engine.adjustRecordingSignalVolume?.(130);
    } catch (e) {
      console.warn('Audio routing setup warning:', e);
    }
  }, []);

  const joinAgoraChannelNow = useCallback((engine) => {
    if (!engine || !roomCode) return;
    try {
      applyLoudSpeakerMediaAudio(engine);
      engine.setClientRole?.(ClientRoleType?.ClientRoleBroadcaster ?? 1);

      const options = buildMediaOptions({
        mic: isMicOnRef.current,
        camera: isVideoOnRef.current,
        screen: isScreenSharingRef.current,
      });

      const res = engine.joinChannel('', roomCode, myAgoraUidRef.current, options);
      if (res === -17) {
        engine.leaveChannel();
        setTimeout(() => {
          try {
            applyLoudSpeakerMediaAudio(engine);
            engine.joinChannel('', roomCode, myAgoraUidRef.current, options);
          } catch (e) {}
        }, 350);
      }
    } catch (err) {
      console.warn('joinAgoraChannelNow error:', err);
    }
  }, [roomCode, applyLoudSpeakerMediaAudio, buildMediaOptions]);

  const applyMediaState = useCallback((media) => {
    if (!media || !media.type) return;
    setMediaType(media.type);
    if (media.type === 'youtube') {
      const id = extractYoutubeId(media.url);
      if (id) setYoutubeId(id);
    } else if (media.type === 'upload') {
      setMediaUrl(getMediaUrl(media.url));
    } else if (media.type === 'screen_share') {
      setMediaUrl(media.url || '');
      if (agoraEngineRef.current) {
        try {
          agoraEngineRef.current.enableVideo();
        } catch (e) {}
      }
    } else {
      setMediaUrl('');
      setYoutubeId('');
    }
    const shouldPlay = media.status === 'playing';
    setPlaying(shouldPlay);
    if (!shouldPlay && videoPlayerRef.current) {
      videoPlayerRef.current.pauseAsync().catch(() => {});
    }
  }, []);

  const fetchRoomDetails = useCallback(async () => {
    try {
      let room = null;
      if (!isHost || !currentRoomId) {
        try {
          const joinRes = await axiosInstance.post('/watch/join', { roomCode });
          room = joinRes?.data?.room;
        } catch (joinErr) {}
      }
      if (!room) {
        const lookupId = currentRoomId || roomCode;
        if (lookupId) {
          const response = await axiosInstance.get(`/watch/${lookupId}`);
          room = response?.data?.room;
        }
      }
      if (room) {
        setRoomData(room);
        if (room._id) setCurrentRoomId(room._id);
        if (!initialMediaLoadedRef.current && room.currentMedia && room.currentMedia.type !== 'none') {
          initialMediaLoadedRef.current = true;
          applyMediaState(room.currentMedia);
        }
      }
    } catch (error) {
      console.warn('Error fetching watch room details:', error?.message);
    } finally {
      setIsRoomLoading(false);
    }
  }, [isHost, currentRoomId, roomCode, applyMediaState]);

  const cleanupAgoraEngine = useCallback(() => {
    const engine = agoraEngineRef.current;
    if (!engine) return;
    try {
      engine.stopPreview?.();
      if (isScreenSharingRef.current) {
        engine.stopScreenCapture?.();
      }
      engine.muteLocalAudioStream?.(true);
      engine.muteLocalVideoStream?.(true);
      engine.enableLocalAudio?.(false);
      engine.enableLocalVideo?.(false);
      engine.leaveChannel?.();
      engine.disableVideo?.();
      engine.disableAudio?.();
      if (agoraEventHandlerRef.current) {
        if (typeof engine.unregisterEventHandler === 'function') {
          engine.unregisterEventHandler(agoraEventHandlerRef.current);
        } else if (typeof engine.removeAllListeners === 'function') {
          engine.removeAllListeners();
        }
      }
    } catch (e) {
      console.warn('Error cleaning up Agora engine:', e);
    }
  }, []);

  // Agora Initialization Sequence
  useEffect(() => {
    let isMounted = true;
    let initTimer = null;

    const initEngine = async () => {
      try {
        let hasPerms = true;
        if (Platform.OS === 'android') {
          const permissions = [
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            PermissionsAndroid.PERMISSIONS.CAMERA,
          ];
          if (Platform.Version >= 31 && PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
            permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
          }
          const validPermissions = permissions.filter(Boolean);
          if (validPermissions.length > 0) {
            const granted = await PermissionsAndroid.requestMultiple(validPermissions);
            hasPerms =
              granted['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED &&
              granted['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED;
          }
        }

        if (!isMounted) return;
        setIsPermissionsGranted(hasPerms);

        if (!hasPerms) {
          setAgoraStatusText('Permissions required');
          setLoadingPhase(3);
          return;
        }

        if (!isAgoraAvailable || !createAgoraRtcEngine) {
          setAgoraStatusText('Native build required');
          setLoadingPhase(3);
          return;
        }

        if (!globalAgoraEngine) {
          globalAgoraEngine = createAgoraRtcEngine();
          globalAgoraEngine.initialize({
            appId: AGORA_APP_ID,
            channelProfile: ChannelProfileType?.ChannelProfileLiveBroadcasting ?? 1,
            audioScenario: AudioScenarioType?.AudioScenarioGameStreaming ?? 3,
          });
        }
        const engine = globalAgoraEngine;
        agoraEngineRef.current = engine;

        const eventHandler = {
          onJoinChannelSuccess: (connection) => {
            if (!isMounted) return;
            setIsJoined(true);
            setAgoraStatusText('Live Audio/Video Ready');
            const joinedUid = connection?.localUid || myAgoraUidRef.current;
            setLocalUid(joinedUid);
            applyLoudSpeakerMediaAudio(engine);
          },
          onUserJoined: (_connection, uid) => {
            if (!isMounted) return;
            try {
              engine.enableVideo();
              engine.muteRemoteAudioStream?.(uid, false);
              engine.muteRemoteVideoStream?.(uid, false);
            } catch (e) {}
            setRemoteUids((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
          },
          onUserOffline: (_connection, uid) => {
            if (!isMounted) return;
            setRemoteUids((prev) => prev.filter((id) => id !== uid));
            setRemoteVideoUids((prev) => prev.filter((id) => id !== uid));
          },
          onRemoteVideoStateChanged: (_connection, remoteUid, state) => {
            if (!isMounted) return;
            if (state === 1 || state === 2) {
              setRemoteUids((prev) => (prev.includes(remoteUid) ? prev : [...prev, remoteUid]));
              setRemoteVideoUids((prev) => (prev.includes(remoteUid) ? prev : [...prev, remoteUid]));
            } else if (state === 0) {
              setRemoteVideoUids((prev) => prev.filter((id) => id !== remoteUid));
            }
          },
          onLocalVideoStateChanged: (source, state) => {
            if (!isMounted) return;
            const screenSource = VideoSourceType?.VideoSourceScreenPrimary ?? 2;
            if (source === screenSource && (state === 1 || state === 2) && isScreenSharingRef.current) {
              try {
                applyLoudSpeakerMediaAudio(engine);
                engine.updateChannelMediaOptions(
                  buildMediaOptions({ mic: isMicOnRef.current, camera: false, screen: true })
                );
              } catch (e) {}
            }
          },
          onConnectionStateChanged: (_connection, state, reason) => {
            if (!isMounted) return;
            if (state === 3) {
              setIsJoined(true);
              setAgoraStatusText('Live Audio/Video Ready');
            } else if (state === 2 || state === 4) {
              setAgoraStatusText('Connecting...');
            } else if (state === 5) {
              setIsJoined(false);
              setAgoraStatusText(`Call Failed (${reason})`);
            }
          },
          onError: (err, msg) => {
            console.log('Agora Error:', err, msg);
            if (isMounted && err && err !== 0) {
              setAgoraStatusText(`RTC Warning (${err})`);
            }
          },
        };

        agoraEventHandlerRef.current = eventHandler;
        engine.registerEventHandler(eventHandler);

        try {
          engine.setChannelProfile?.(ChannelProfileType?.ChannelProfileLiveBroadcasting ?? 1);
          engine.setClientRole?.(ClientRoleType?.ClientRoleBroadcaster ?? 1);
          applyLoudSpeakerMediaAudio(engine);

          engine.enableAudio();
          engine.enableVideo();
          engine.setVideoEncoderConfiguration?.({
            dimensions: { width: 640, height: 480 },
            frameRate: 24,
            bitrate: 800,
          });
          engine.enableLocalAudio(false);
          engine.enableLocalVideo(false);
          engine.muteLocalAudioStream(true);
          engine.muteLocalVideoStream(true);

          joinAgoraChannelNow(engine);
        } catch (callErr) {
          console.warn('Agora joinChannel error:', callErr);
        }

        if (isMounted) setIsEngineInitialized(true);
      } catch (engineError) {
        console.warn('Agora engine failed to initialize:', engineError);
      } finally {
        if (isMounted) {
          setLoadingPhase(3);
        }
      }
    };

    initTimer = setTimeout(() => {
      if (isMounted) initEngine();
    }, 300);

    return () => {
      isMounted = false;
      if (initTimer) clearTimeout(initTimer);
      cleanupAgoraEngine();
    };
  }, [roomCode, applyLoudSpeakerMediaAudio, buildMediaOptions, joinAgoraChannelNow, cleanupAgoraEngine]);

  const showReaction = useCallback((reaction) => {
    setActiveReaction({ emoji: reaction, key: Date.now() });
    if (reactionTimeoutRef.current) {
      clearTimeout(reactionTimeoutRef.current);
    }
    reactionTimeoutRef.current = setTimeout(() => {
      setActiveReaction(null);
    }, 4500);
  }, []);

  useEffect(() => {
    fetchRoomDetails();
    if (!socket) return;

    socket.emit('join_watch_room', { roomCode });

    const onMediaPlay = () => {
      setPlaying(true);
      if (videoPlayerRef.current) videoPlayerRef.current.playAsync().catch(() => {});
    };

    const onMediaPause = () => {
      setPlaying(false);
      if (videoPlayerRef.current) videoPlayerRef.current.pauseAsync().catch(() => {});
    };

    const onMediaSeek = ({ timestamp }) => {
      const currentType = mediaTypeRef.current;
      if (currentType === 'youtube' && playerRef.current) {
        playerRef.current.seekTo(timestamp, true);
      } else if (currentType === 'upload' && videoPlayerRef.current) {
        videoPlayerRef.current.setPositionAsync(timestamp * 1000).catch(() => {});
      }
    };

    const onChangeMedia = ({ media }) => {
      initialMediaLoadedRef.current = true;
      applyMediaState(media);
    };

    const onKickUser = ({ userId }) => {
      if (userId && user?._id && userId.toString() === user._id.toString()) {
        Alert.alert('Removed from Room', 'The host has removed you from the watch party.');
        cleanupAgoraEngine();
        navigation.goBack();
      } else {
        fetchRoomDetails();
      }
    };

    const onDeleteRoom = () => {
      Alert.alert('Room Ended', 'The host has closed this watch room.');
      cleanupAgoraEngine();
      navigation.goBack();
    };

    const onMediaUploading = ({ progress }) => {
      if (progress < 100) {
        setIsHostUploading(true);
        setUploadProgress(progress);
      } else {
        setIsHostUploading(false);
        setUploadProgress(0);
      }
    };

    const onInviteAccepted = ({ guestName }) => {
      Toast.show({ type: 'success', text1: `${guestName || 'Partner'} accepted your invite!`, position: 'top' });
      fetchRoomDetails();
    };

    const onInviteRejected = ({ guestName }) => {
      Toast.show({ type: 'error', text1: `${guestName || 'Partner'} declined your invite.`, position: 'top' });
    };

    const onParticipantChanged = () => {
      fetchRoomDetails();
    };

    const onSyncMedia = async ({ timestamp, playing: hostPlaying }) => {
      const currentType = mediaTypeRef.current;
      const currentPlaying = playingRef.current;

      if (typeof hostPlaying === 'boolean' && hostPlaying !== currentPlaying) {
        setPlaying(hostPlaying);
        if (currentType === 'upload' && videoPlayerRef.current) {
          if (hostPlaying) {
            videoPlayerRef.current.playAsync().catch(() => {});
          } else {
            videoPlayerRef.current.pauseAsync().catch(() => {});
          }
        }
      }

      try {
        let localTime = 0;
        if (currentType === 'youtube' && playerRef.current) {
          localTime = (await playerRef.current.getCurrentTime()) || 0;
        } else if (currentType === 'upload' && videoPlayerRef.current) {
          const status = await videoPlayerRef.current.getStatusAsync();
          if (status.isLoaded) localTime = status.positionMillis / 1000;
        }

        if (typeof timestamp === 'number' && Math.abs(localTime - timestamp) > 2.5) {
          if (currentType === 'youtube' && playerRef.current) {
            playerRef.current.seekTo(timestamp, true);
          } else if (currentType === 'upload' && videoPlayerRef.current) {
            await videoPlayerRef.current.setPositionAsync(timestamp * 1000);
          }
        }
      } catch (err) {}
    };

    const onReceiveReaction = ({ reaction }) => {
      showReaction(reaction);
    };

    socket.on('receive_media_play', onMediaPlay);
    socket.on('receive_media_pause', onMediaPause);
    socket.on('receive_media_seek', onMediaSeek);
    socket.on('receive_change_media', onChangeMedia);
    socket.on('receive_kick_user', onKickUser);
    socket.on('receive_delete_room', onDeleteRoom);
    socket.on('receive_media_uploading', onMediaUploading);
    socket.on('watch_invite_accepted', onInviteAccepted);
    socket.on('watch_invite_rejected', onInviteRejected);
    socket.on('participant_joined', onParticipantChanged);
    socket.on('participant_left', onParticipantChanged);
    socket.on('receive_sync_media', onSyncMedia);
    socket.on('receive_reaction', onReceiveReaction);

    return () => {
      socket.emit('leave_watch_room', { roomCode });
      socket.off('receive_media_play', onMediaPlay);
      socket.off('receive_media_pause', onMediaPause);
      socket.off('receive_media_seek', onMediaSeek);
      socket.off('receive_change_media', onChangeMedia);
      socket.off('receive_kick_user', onKickUser);
      socket.off('receive_delete_room', onDeleteRoom);
      socket.off('receive_media_uploading', onMediaUploading);
      socket.off('watch_invite_accepted', onInviteAccepted);
      socket.off('watch_invite_rejected', onInviteRejected);
      socket.off('participant_joined', onParticipantChanged);
      socket.off('participant_left', onParticipantChanged);
      socket.off('receive_sync_media', onSyncMedia);
      socket.off('receive_reaction', onReceiveReaction);
      if (reactionTimeoutRef.current) {
        clearTimeout(reactionTimeoutRef.current);
      }
    };
  }, [socket, roomCode, user?._id, navigation, fetchRoomDetails, applyMediaState, showReaction, cleanupAgoraEngine]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRoomDetails();
    setRefreshing(false);
  }, [fetchRoomDetails]);

  const handleChangeMedia = () => {
    const id = extractYoutubeId(ytInput);
    if (!id) {
      Alert.alert('Invalid URL', 'Please enter a valid YouTube link or 11-character video ID.');
      return;
    }
    setYoutubeId(id);
    setMediaType('youtube');
    setPlaying(false);
    setShowMediaModal(false);
    setYtInput('');

    if (socket) {
      socket.emit('change_media', {
        roomCode,
        media: { type: 'youtube', url: id },
      });
    }
  };

  const onStateChange = useCallback(
    (state) => {
      if (!isHost) return;
      if (state === 'playing') {
        setPlaying(true);
        socket?.emit('media_play', { roomCode, timestamp: 0 });
      } else if (state === 'paused') {
        setPlaying(false);
        socket?.emit('media_pause', { roomCode, timestamp: 0 });
      }
    },
    [isHost, socket, roomCode]
  );

  useEffect(() => {
    let syncInterval;
    if (isHost && socket && playing && (mediaType === 'youtube' || mediaType === 'upload')) {
      syncInterval = setInterval(async () => {
        try {
          let currentTime = 0;
          if (mediaType === 'youtube' && playerRef.current) {
            currentTime = (await playerRef.current.getCurrentTime()) || 0;
          } else if (mediaType === 'upload' && videoPlayerRef.current) {
            const status = await videoPlayerRef.current.getStatusAsync();
            if (status.isLoaded) currentTime = status.positionMillis / 1000;
          }
          socket.emit('sync_media', { roomCode, timestamp: currentTime, playing });
        } catch (e) {}
      }, 3000);
    }
    return () => {
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [isHost, socket, playing, mediaType, roomCode]);

  const handleSendReaction = (emoji) => {
    showReaction(emoji);
    if (socket) {
      socket.emit('send_reaction', {
        roomCode,
        reaction: emoji,
        senderName: user?.fullName || user?.username || user?.email || 'Partner',
      });
    }
  };

  const handleUploadVideo = async () => {
    if (!isHost) return;
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const videoAsset = result.assets[0];
        setUploading(true);

        const formData = new FormData();
        formData.append('media', {
          uri: Platform.OS === 'ios' ? videoAsset.uri.replace('file://', '') : videoAsset.uri,
          name: videoAsset.fileName || 'upload.mp4',
          type: videoAsset.mimeType || 'video/mp4',
        });

        const res = await axiosInstance.post('/upload', formData, {
          headers: { Accept: 'application/json' },
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total || 1;
            const percentCompleted = Math.min(99, Math.round((progressEvent.loaded * 100) / total));
            setUploadProgress(percentCompleted);
            if (socket) {
              socket.emit('media_uploading', { roomCode, progress: percentCompleted });
            }
          },
        });

        const uploadedUrl = res.data.url;
        setUploadProgress(0);
        if (socket) {
          socket.emit('media_uploading', { roomCode, progress: 100 });
        }
        setMediaType('upload');
        setMediaUrl(getMediaUrl(uploadedUrl));
        setPlaying(false);
        if (videoPlayerRef.current) videoPlayerRef.current.pauseAsync().catch(() => {});

        if (socket) {
          socket.emit('change_media', {
            roomCode,
            media: { type: 'upload', url: uploadedUrl },
          });
        }
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      if (socket) {
        socket.emit('media_uploading', { roomCode, progress: 100 });
      }
      Alert.alert('Upload Failed', 'Failed to upload video. Please try a smaller video file.');
    } finally {
      setUploading(false);
    }
  };

  const handleScreenShare = async () => {
    if (!isHost) return;
    const engine = agoraEngineRef.current;
    if (!engine || !isEngineInitialized) {
      Alert.alert('Unavailable', 'Screen sharing requires a native build with camera and microphone permissions enabled.');
      return;
    }
    try {
      if (isScreenSharing) {
        engine.stopScreenCapture();
        engine.updateChannelMediaOptions(
          buildMediaOptions({ mic: isMicOnRef.current, camera: false, screen: false })
        );
        setIsScreenSharing(false);
        isScreenSharingRef.current = false;
        setMediaType('none');
        setMediaUrl('');
        if (socket) {
          socket.emit('change_media', { roomCode, media: { type: 'none', url: '' } });
        }
      } else {
        if (!isJoined) {
          joinAgoraChannelNow(engine);
        }

        if (isVideoOnRef.current) {
          engine.stopPreview?.();
          engine.enableLocalVideo?.(false);
          setIsVideoOn(false);
          isVideoOnRef.current = false;
        }

        applyLoudSpeakerMediaAudio(engine);
        engine.enableVideo();
        engine.muteLocalVideoStream(false);

        const capRes = engine.startScreenCapture({
          captureVideo: true,
          captureAudio: true,
          videoParams: {
            dimensions: { width: 1280, height: 720 },
            frameRate: 15,
            bitrate: 1200,
          },
          audioParams: {
            sampleRate: 48000,
            channels: 2,
            captureSignalVolume: 100,
          },
        });

        if (capRes !== 0) {
          console.warn('startScreenCapture returned:', capRes);
        }

        isScreenSharingRef.current = true;
        setIsScreenSharing(true);
        setMediaType('screen_share');

        const hostShareUid = String(localUid || myAgoraUidRef.current);
        setMediaUrl(hostShareUid);

        engine.updateChannelMediaOptions(
          buildMediaOptions({ mic: isMicOnRef.current, camera: false, screen: true })
        );

        setTimeout(() => {
          if (isScreenSharingRef.current && agoraEngineRef.current) {
            try {
              agoraEngineRef.current.updateChannelMediaOptions(
                buildMediaOptions({ mic: isMicOnRef.current, camera: false, screen: true })
              );
            } catch (e) {}
          }
        }, 1800);

        if (socket) {
          socket.emit('change_media', {
            roomCode,
            media: { type: 'screen_share', url: hostShareUid },
          });
        }
      }
    } catch (error) {
      console.error('Error with screen share:', error);
      Alert.alert('Screen Share Error', 'Could not toggle screen share on this device.');
    }
  };

  const handleDeleteRoom = () => {
    Alert.alert(
      'Delete Room',
      'Are you sure you want to delete this room? This will end the watch party for everyone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsVideoOn(false);
              setIsScreenSharing(false);
              cleanupAgoraEngine();
              if (socket) {
                socket.emit('delete_room', { roomCode });
              }
              await axiosInstance.delete(`/watch/${currentRoomId || roomCode}`);
              setShowSettingsModal(false);
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting room:', error);
              setShowSettingsModal(false);
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const performLeaveRoom = () => {
    setIsVideoOn(false);
    setIsScreenSharing(false);
    setShowSettingsModal(false);
    cleanupAgoraEngine();
    if (socket) {
      socket.emit('leave_watch_room', { roomCode });
    }
    navigation.goBack();
  };

  const handleLeaveRoom = () => {
    if (isHost) {
      Alert.alert('Leave Room', 'Do you want to just leave, or delete the room for everyone?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave Only', onPress: performLeaveRoom },
        { text: 'Delete Room', style: 'destructive', onPress: handleDeleteRoom },
      ]);
    } else {
      Alert.alert('Leave Room', 'Are you sure you want to leave this Watch Together room?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave Room', style: 'destructive', onPress: performLeaveRoom },
      ]);
    }
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
    if (!user?.partner) {
      Alert.alert('No Partner', 'You do not have a partner connected to invite.');
      return;
    }
    if (socket) {
      const partnerId = typeof user.partner === 'object' ? user.partner._id : user.partner;
      socket.emit('invite_partner_watch', {
        partnerId,
        roomCode,
        roomId: currentRoomId || roomData?._id,
        hostId: user._id,
        hostName: user.fullName || user.username || user.email,
      });
      Toast.show({ type: 'success', text1: 'Invite Sent! 🍿', text2: 'An invite has been sent to your partner.' });
    }
  };

  const handleToggleMic = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', 'Microphone access is required for voice calls.');
        return;
      }
    }

    const engine = agoraEngineRef.current;
    if (!engine) {
      Toast.show({ type: 'info', text1: 'Voice Call Unavailable', text2: 'Audio engine is only available in the installed app build.' });
      return;
    }

    try {
      const newMicState = !isMicOn;
      isMicOnRef.current = newMicState;
      setIsMicOn(newMicState);

      if (!isJoined) {
        joinAgoraChannelNow(engine);
      }

      applyLoudSpeakerMediaAudio(engine);
      engine.setClientRole?.(ClientRoleType?.ClientRoleBroadcaster ?? 1);

      if (newMicState) {
        engine.enableAudio();
        engine.enableLocalAudio(true);
        engine.muteLocalAudioStream(false);
        engine.setEnableSpeakerphone?.(true);
        engine.adjustRecordingSignalVolume?.(150);
        engine.adjustPlaybackSignalVolume?.(140);
      } else {
        engine.muteLocalAudioStream(true);
        engine.enableLocalAudio(false);
      }

      engine.updateChannelMediaOptions(
        buildMediaOptions({
          mic: newMicState,
          camera: isVideoOnRef.current,
          screen: isScreenSharingRef.current,
        })
      );
    } catch (e) {
      console.warn('Toggle mic error:', e);
    }
  };

  const handleToggleVideo = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', 'Camera access is required for video calls.');
        return;
      }
    }

    const engine = agoraEngineRef.current;
    if (!engine) {
      Toast.show({ type: 'info', text1: 'Video Call Unavailable', text2: 'Video engine is only available in the installed app build.' });
      return;
    }

    try {
      const newVideoState = !isVideoOn;

      if (newVideoState && isScreenSharingRef.current) {
        engine.stopScreenCapture?.();
        setIsScreenSharing(false);
        isScreenSharingRef.current = false;
        setMediaType('none');
        if (socket) {
          socket.emit('change_media', { roomCode, media: { type: 'none', url: '' } });
        }
      }

      isVideoOnRef.current = newVideoState;
      setIsVideoOn(newVideoState);

      if (!isJoined) {
        joinAgoraChannelNow(engine);
      }

      engine.setClientRole?.(ClientRoleType?.ClientRoleBroadcaster ?? 1);

      if (newVideoState) {
        engine.enableVideo();
        engine.enableLocalVideo(true);
        engine.muteLocalVideoStream(false);
        engine.startPreview(VideoSourceType?.VideoSourceCameraPrimary ?? 0);
      } else {
        engine.muteLocalVideoStream(true);
        engine.enableLocalVideo(false);
        engine.stopPreview(VideoSourceType?.VideoSourceCameraPrimary ?? 0);
      }

      engine.updateChannelMediaOptions(
        buildMediaOptions({
          mic: isMicOnRef.current,
          camera: newVideoState,
          screen: false,
        })
      );
    } catch (e) {
      console.warn('Toggle video error:', e);
    }
  };

  const handleSwitchCamera = () => {
    try {
      agoraEngineRef.current?.switchCamera?.();
    } catch (e) {}
  };

  const participants = (roomData?.participants || []).filter(Boolean);
  const hostId = typeof roomData?.host === 'object' ? roomData?.host?._id : roomData?.host;

  const parsedShareUid = parseInt(mediaUrl, 10);
  const screenShareUid =
    mediaType === 'screen_share'
      ? (Number.isFinite(parsedShareUid) && parsedShareUid > 0
          ? parsedShareUid
          : remoteVideoUids[0] || remoteUids[0] || 0)
      : 0;

  const activeRemoteCameraUid =
    mediaType === 'screen_share'
      ? remoteVideoUids.find((uid) => uid !== screenShareUid) || 0
      : remoteVideoUids[0] || remoteUids[0] || 0;

  const showVideoCallPanel =
    (isVideoOn || (activeRemoteCameraUid > 0 && mediaType !== 'screen_share')) &&
    isEngineInitialized &&
    isPermissionsGranted;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      {(loadingPhase < 3 || isRoomLoading) && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 999, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ color: '#fff', marginTop: 15, fontSize: 18, fontWeight: 'bold' }}>{loadingText}</Text>
          <View style={{ width: '60%', height: 6, backgroundColor: '#333', borderRadius: 3, marginTop: 15, overflow: 'hidden' }}>
            <View style={{ width: `${loadingProgress}%`, height: '100%', backgroundColor: theme.colors.primary }} />
          </View>
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={handleLeaveRoom} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {roomData?.roomName || `Room ${roomCode}`}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.primary }]}>
            Code: {roomCode}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {!isHost && (
            <TouchableOpacity onPress={handleLeaveRoom} style={styles.headerLeavePill}>
              <Ionicons name="exit-outline" size={16} color="#ff4757" />
              <Text style={styles.headerLeaveText}>Leave</Text>
            </TouchableOpacity>
          )}
          {isHost && (
            <TouchableOpacity onPress={handleAddParticipant} style={[styles.settingsButton, { marginRight: 6 }]}>
              <Ionicons name="person-add-outline" size={22} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowSettingsModal(true)} style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* Media Area */}
        <View style={[styles.mediaContainer, { backgroundColor: '#000' }]}>
          {mediaType === 'youtube' && youtubeId ? (
            <View style={styles.playerWrapper}>
              <View pointerEvents={isHost ? 'auto' : 'none'} style={styles.playerInner}>
                <YoutubeIframe
                  ref={playerRef}
                  height={PLAYER_HEIGHT}
                  width={SCREEN_WIDTH}
                  videoId={youtubeId}
                  play={playing}
                  onChangeState={onStateChange}
                  webViewProps={{
                    androidLayerType: 'hardware',
                    renderToHardwareTextureAndroid: true,
                    allowsFullscreenVideo: true,
                  }}
                />
              </View>
            </View>
          ) : mediaType === 'upload' && mediaUrl ? (
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
                      if (status.isPlaying && !playingRef.current) {
                        setPlaying(true);
                        socket?.emit('media_play', { roomCode, timestamp: status.positionMillis / 1000 });
                      } else if (!status.isPlaying && playingRef.current) {
                        setPlaying(false);
                        socket?.emit('media_pause', { roomCode, timestamp: status.positionMillis / 1000 });
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
                {isHost ? 'Uploading video...' : 'Host is uploading video...'} {uploadProgress}%
              </Text>
              <View style={{ width: '60%', height: 6, backgroundColor: '#333', marginTop: 15, borderRadius: 3 }}>
                <View style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: theme.colors.primary, borderRadius: 3 }} />
              </View>
            </View>
          ) : mediaType === 'screen_share' ? (
            <View style={styles.playerWrapper}>
              <View style={styles.playerInner}>
                {isHost ? (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                    <Ionicons name="desktop-outline" size={52} color={theme.colors.primary} />
                    <Text style={{ color: '#fff', marginTop: 10, fontSize: 16, fontWeight: '700' }}>
                      You are sharing your screen
                    </Text>
                    <Text style={{ color: '#bbb', marginTop: 4, fontSize: 12, textAlign: 'center' }}>
                      Switch to any app or video and your partner will see it live.
                    </Text>
                    <TouchableOpacity
                      style={{ marginTop: 14, backgroundColor: '#ff4757', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 }}
                      onPress={handleScreenShare}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Stop Sharing</Text>
                    </TouchableOpacity>
                  </View>
                ) : isEngineInitialized && isPermissionsGranted && isAgoraAvailable && AgoraVideoView && screenShareUid > 0 ? (
                  <AgoraVideoView
                    key={`screen_${screenShareUid}`}
                    canvas={{
                      uid: screenShareUid,
                      sourceType: VideoSourceType?.VideoSourceRemote ?? 9,
                      renderMode: RenderModeType?.RenderModeFit ?? 2,
                    }}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <View style={styles.noMediaContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.noMediaText}>Connecting to host screen share...</Text>
                    {!isJoined && agoraEngineRef.current && (
                      <TouchableOpacity
                        style={{ marginTop: 12, backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 }}
                        onPress={() => joinAgoraChannelNow(agoraEngineRef.current)}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Tap to Reconnect</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.noMediaContainer}>
              <Ionicons name="film-outline" size={56} color="#666" />
              <Text style={styles.noMediaText}>
                {isHost ? 'Select YouTube, Upload Video, or Share Screen below' : 'Waiting for host to start media...'}
              </Text>
            </View>
          )}
        </View>

        {/* Host Controls */}
        {isHost && (
          <View style={[styles.controlsContainer, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.controlsTitle, { color: theme.colors.text }]}>Host Controls</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlsRow}>
              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}
                onPress={() => setShowMediaModal(true)}
              >
                <Ionicons name="logo-youtube" size={24} color="#ff0000" />
                <Text style={[styles.controlButtonText, { color: theme.colors.text }]}>YouTube</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}
                onPress={handleUploadVideo}
                disabled={uploading}
              >
                <Ionicons name="cloud-upload-outline" size={24} color={theme.colors.primary} />
                <Text style={[styles.controlButtonText, { color: theme.colors.text }]}>
                  {uploading ? 'Uploading...' : 'Upload Video'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: isScreenSharing ? '#ff4757' : theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}
                onPress={handleScreenShare}
              >
                <Ionicons name="desktop-outline" size={24} color={isScreenSharing ? '#fff' : theme.colors.text} />
                <Text style={[styles.controlButtonText, { color: isScreenSharing ? '#fff' : theme.colors.text }]}>
                  {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Call Controls (For Everyone) */}
        <View style={[styles.controlsContainer, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.controlsHeaderRow}>
            <Text style={[styles.controlsTitle, { color: theme.colors.text, marginBottom: 0 }]}>Call Controls</Text>
            <TouchableOpacity
              onPress={() => {
                if (!isJoined && agoraEngineRef.current) {
                  joinAgoraChannelNow(agoraEngineRef.current);
                  Toast.show({ type: 'info', text1: 'Reconnecting call...' });
                }
              }}
              style={[
                styles.rtcStatusPill,
                { backgroundColor: isJoined ? 'rgba(46, 204, 113, 0.14)' : 'rgba(245, 158, 11, 0.14)' },
              ]}
            >
              <View style={[styles.rtcStatusDot, { backgroundColor: isJoined ? '#2ecc71' : '#f59e0b' }]} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: isJoined ? '#2ecc71' : '#d97706' }}>
                {agoraStatusText}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.controlsRow, { marginTop: 10 }]}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                {
                  backgroundColor: isMicOn ? 'rgba(46, 204, 113, 0.14)' : theme.colors.card,
                  borderColor: isMicOn ? '#2ecc71' : theme.colors.border,
                  borderWidth: 1,
                },
              ]}
              onPress={handleToggleMic}
            >
              <Ionicons name={isMicOn ? 'mic' : 'mic-off'} size={22} color={isMicOn ? '#2ecc71' : '#ff4757'} />
              <Text style={[styles.controlButtonText, { color: theme.colors.text }]}>{isMicOn ? 'Mic On' : 'Mic Muted'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlButton,
                {
                  backgroundColor: isVideoOn ? 'rgba(46, 204, 113, 0.14)' : theme.colors.card,
                  borderColor: isVideoOn ? '#2ecc71' : theme.colors.border,
                  borderWidth: 1,
                },
              ]}
              onPress={handleToggleVideo}
            >
              <Ionicons name={isVideoOn ? 'videocam' : 'videocam-off'} size={22} color={isVideoOn ? '#2ecc71' : '#ff4757'} />
              <Text style={[styles.controlButtonText, { color: theme.colors.text }]}>{isVideoOn ? 'Video On' : 'Video Off'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}
              onPress={handleAddParticipant}
            >
              <Ionicons name="person-add-outline" size={22} color={theme.colors.primary} />
              <Text style={[styles.controlButtonText, { color: theme.colors.text }]}>Invite Partner</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: 'rgba(255, 71, 87, 0.14)', borderColor: 'rgba(255, 71, 87, 0.35)', borderWidth: 1 }]}
              onPress={handleLeaveRoom}
            >
              <Ionicons name="exit-outline" size={22} color="#ff4757" />
              <Text style={[styles.controlButtonText, { color: '#ff4757' }]}>Leave Room</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Reaction Tab */}
        <View style={[styles.reactionTabContainer, { borderBottomColor: theme.colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactionScroll}>
            {['❤️', '😂', '😮', '👍', '🔥', '🎉', '🥺', '🍿'].map((emoji, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.reactionButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}
                onPress={() => handleSendReaction(emoji)}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Participants & Video Call */}
        <View style={styles.participantsSection}>
          {showVideoCallPanel && (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 0 }]}>Live Video Call</Text>
                {isVideoOn && (
                  <TouchableOpacity
                    style={[styles.flipCameraBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    onPress={handleSwitchCamera}
                  >
                    <Ionicons name="camera-reverse-outline" size={18} color={theme.colors.primary} />
                    <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>Flip</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={[styles.videoCallContainer, { backgroundColor: '#000' }]}>
                {activeRemoteCameraUid > 0 ? (
                  <View style={styles.agoraVideoContainer}>
                    {isAgoraAvailable && AgoraVideoView ? (
                      <AgoraVideoView
                        key={`remote_${activeRemoteCameraUid}`}
                        canvas={{
                          uid: activeRemoteCameraUid,
                          sourceType: VideoSourceType?.VideoSourceRemote ?? 9,
                          renderMode: RenderModeType?.RenderModeHidden ?? 1,
                        }}
                        style={styles.agoraVideoView}
                      />
                    ) : (
                      <View style={[styles.agoraVideoView, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="person" size={40} color="#666" />
                      </View>
                    )}

                    <View style={styles.localVideoLabel}>
                      <Text style={styles.localVideoLabelText}>Partner</Text>
                    </View>

                    {isVideoOn && (
                      <View style={[styles.pipVideoContainer, { borderColor: theme.colors.primary }]}>
                        {isAgoraAvailable && AgoraVideoView ? (
                          <AgoraVideoView
                            key="local_pip"
                            canvas={{
                              uid: 0,
                              sourceType: VideoSourceType?.VideoSourceCameraPrimary ?? 0,
                              renderMode: RenderModeType?.RenderModeHidden ?? 1,
                            }}
                            style={styles.agoraVideoView}
                          />
                        ) : (
                          <View style={[styles.agoraVideoView, { backgroundColor: '#444', justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons name="videocam-off" size={30} color="#777" />
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.mainVideoContainer}>
                    {isVideoOn ? (
                      <>
                        {isAgoraAvailable && AgoraVideoView ? (
                          <AgoraVideoView
                            key="local_main"
                            canvas={{
                              uid: 0,
                              sourceType: VideoSourceType?.VideoSourceCameraPrimary ?? 0,
                              renderMode: RenderModeType?.RenderModeHidden ?? 1,
                            }}
                            style={styles.agoraVideoView}
                          />
                        ) : (
                          <View style={[styles.agoraVideoView, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons name="videocam" size={40} color="#666" />
                          </View>
                        )}
                        <View style={styles.localVideoLabel}>
                          <Text style={styles.localVideoLabelText}>You (Camera On)</Text>
                        </View>
                      </>
                    ) : (
                      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="videocam-off-outline" size={40} color={theme.colors.textSecondary} />
                      </View>
                    )}
                  </View>
                )}
              </View>
            </>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 12 }}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 0, marginBottom: 0 }]}>
              Participants ({participants.length || 1})
            </Text>
            <TouchableOpacity onPress={onRefresh} style={{ padding: 5 }}>
              <Ionicons name="refresh" size={22} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {participants.length === 0 && user ? (
            <View style={[styles.participantRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}>
              <View style={styles.participantInfo}>
                <View style={[styles.avatar, { backgroundColor: theme.colors.primary, overflow: 'hidden' }]}>
                  {user.avatar ? (
                    <Image source={{ uri: getMediaUrl(user.avatar) }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                  ) : (
                    <Text style={styles.avatarText}>{(user.fullName || user.username || 'U').charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <Text style={[styles.participantName, { color: theme.colors.text }]}>
                  {user.fullName || user.username} {isHost ? '(Host)' : ''}
                </Text>
              </View>
            </View>
          ) : (
            participants.map((p, index) => {
              const pId = typeof p === 'object' ? p._id : p;
              const pName = typeof p === 'object' ? p.fullName || p.username || p.email || 'Participant' : 'Participant';
              const pAvatar = typeof p === 'object' ? p.avatar : null;
              const isParticipantHost = hostId && pId && hostId.toString() === pId.toString();

              return (
                <View
                  key={pId ? pId.toString() : `participant-${index}`}
                  style={[styles.participantRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}
                >
                  <View style={styles.participantInfo}>
                    <View style={[styles.avatar, { backgroundColor: theme.colors.primary, overflow: 'hidden' }]}>
                      {pAvatar ? (
                        <Image source={{ uri: getMediaUrl(pAvatar) }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                      ) : (
                        <Text style={styles.avatarText}>{pName.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <Text style={[styles.participantName, { color: theme.colors.text }]}>
                      {pName} {isParticipantHost ? '(Host)' : ''}
                    </Text>
                  </View>

                  {isHost && pId && user?._id && pId.toString() !== user._id.toString() && (
                    <TouchableOpacity
                      style={styles.kickButton}
                      onPress={() => {
                        socket?.emit('kick_user', { roomCode, userId: pId });
                        Toast.show({ type: 'info', text1: 'User Removed', text2: `${pName} has been removed.` });
                      }}
                    >
                      <Ionicons name="person-remove-outline" size={20} color="#ff4757" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Floating Emojis Overlay */}
      {activeReaction && <FloatingEmojis key={activeReaction.key} emoji={activeReaction.emoji} />}

      {/* Media Selection Modal */}
      <Modal visible={showMediaModal} animationType="slide" transparent={true} onRequestClose={() => setShowMediaModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Play YouTube Video</Text>
              <TouchableOpacity onPress={() => setShowMediaModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
              Paste a YouTube video link or Shorts URL below to sync playback with the room.
            </Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="https://www.youtube.com/watch?v=..."
              placeholderTextColor={theme.colors.textSecondary}
              value={ytInput}
              onChangeText={setYtInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity style={[styles.modalButton, { backgroundColor: theme.colors.primary }]} onPress={handleChangeMedia}>
              <Ionicons name="play" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.modalButtonText}>Play for Everyone</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Room Settings Modal */}
      <Modal visible={showSettingsModal} animationType="fade" transparent={true} onRequestClose={() => setShowSettingsModal(false)}>
        <View style={styles.modalOverlayCentered}>
          <View style={[styles.settingsModalContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Room Settings</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.infoRow, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Room Name</Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>{roomData?.roomName || 'Watch Room'}</Text>
            </View>

            <View style={[styles.infoRow, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Room Code</Text>
              <Text style={[styles.infoValue, { color: theme.colors.primary, fontWeight: 'bold' }]}>{roomCode}</Text>
            </View>

            <TouchableOpacity style={[styles.settingsActionBtn, { backgroundColor: theme.colors.inputBackground }]} onPress={handleShareCode}>
              <Ionicons name="share-social-outline" size={22} color={theme.colors.primary} style={{ marginRight: 10 }} />
              <Text style={[styles.settingsActionText, { color: theme.colors.text }]}>Share Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingsActionBtn, { backgroundColor: theme.colors.inputBackground, marginTop: 10 }]}
              onPress={() => {
                setShowSettingsModal(false);
                handleAddParticipant();
              }}
            >
              <Ionicons name="person-add-outline" size={22} color={theme.colors.primary} style={{ marginRight: 10 }} />
              <Text style={[styles.settingsActionText, { color: theme.colors.text }]}>Invite Partner</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingsActionBtn, { backgroundColor: 'rgba(255, 71, 87, 0.12)', marginTop: 10 }]}
              onPress={() => {
                setShowSettingsModal(false);
                handleLeaveRoom();
              }}
            >
              <Ionicons name="exit-outline" size={22} color="#ff4757" style={{ marginRight: 10 }} />
              <Text style={[styles.settingsActionText, { color: '#ff4757' }]}>Leave Room</Text>
            </TouchableOpacity>

            {isHost && (
              <TouchableOpacity
                style={[styles.settingsActionBtn, { backgroundColor: 'rgba(255, 71, 87, 0.18)', marginTop: 10 }]}
                onPress={handleDeleteRoom}
              >
                <Ionicons name="trash-outline" size={22} color="#ff4757" style={{ marginRight: 10 }} />
                <Text style={[styles.settingsActionText, { color: '#ff4757', fontWeight: '700' }]}>Delete Room</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: { padding: 5 },
  headerTitleContainer: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { fontSize: 17, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerLeavePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 71, 87, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 6,
    gap: 4,
  },
  headerLeaveText: { color: '#ff4757', fontSize: 12, fontWeight: '700' },
  settingsButton: { padding: 5 },
  mediaContainer: {
    width: '100%',
    height: PLAYER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerWrapper: { width: '100%', height: '100%' },
  playerInner: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
  noMediaContainer: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  noMediaText: { color: '#aaa', marginTop: 10, fontSize: 15, fontWeight: '500', textAlign: 'center' },
  controlsContainer: { padding: 15, borderBottomWidth: 1 },
  controlsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rtcStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  rtcStatusDot: { width: 7, height: 7, borderRadius: 4 },
  controlsTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 10 },
  controlsRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    marginRight: 10,
    flexDirection: 'row',
  },
  controlButtonText: { fontWeight: '600', fontSize: 14, marginLeft: 7 },
  reactionTabContainer: { paddingVertical: 12, borderBottomWidth: 1 },
  reactionScroll: { paddingHorizontal: 15, alignItems: 'center' },
  reactionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  reactionEmoji: { fontSize: 22 },
  participantsSection: { padding: 15 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 12 },
  flipCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  participantInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  participantName: { fontSize: 16, fontWeight: '600' },
  kickButton: { padding: 8, backgroundColor: 'rgba(255, 71, 87, 0.12)', borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalSubtitle: { fontSize: 14, marginBottom: 20 },
  modalInput: { borderWidth: 1, borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 20 },
  modalButton: { flexDirection: 'row', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  settingsModalContent: { width: '85%', borderRadius: 20, padding: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  infoLabel: { fontSize: 16 },
  infoValue: { fontSize: 16, fontWeight: '500' },
  settingsActionBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginTop: 16 },
  settingsActionText: { fontSize: 15, fontWeight: '600' },
  videoCallContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#000',
  },
  agoraVideoContainer: { flex: 1, position: 'relative', backgroundColor: '#000' },
  mainVideoContainer: { flex: 1, position: 'relative', backgroundColor: '#000' },
  pipVideoContainer: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 100,
    height: 145,
    backgroundColor: '#222',
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    elevation: 10,
    zIndex: 999,
  },
  localVideoLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
  },
  localVideoLabelText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  agoraVideoView: { width: '100%', height: '100%' },
});

export default WatchRoomScreen;
