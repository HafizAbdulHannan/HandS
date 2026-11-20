import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axiosInstance from '../api/axiosConfig';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useThemeContext } from '../context/ThemeContext';

// Import Screens
import SplashScreen from '../screens/SplashScreen';
import IntroScreen from '../screens/IntroScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import VerifyOTPScreen from '../screens/VerifyOTPScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import PairingScreen from '../screens/PairingScreen';
import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';
import ConversationScreen from '../screens/ConversationScreen';
import GalleryScreen from '../screens/GalleryScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingScreen from '../screens/SettingScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import AboutScreen from '../screens/AboutScreen';
import PolicyScreen from '../screens/PolicyScreen';
import NotificationScreen from '../screens/NotificationScreen';
import PartnerProfileScreen from '../screens/PartnerProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import MoreScreen from '../screens/MoreScreen';
import DatesToRememberScreen from '../screens/DatesToRememberScreen';
import WatchLobbyScreen from '../screens/WatchLobbyScreen';
import WatchRoomScreen from '../screens/WatchRoomScreen';
import DrawFunScreen from '../screens/DrawFunScreen';
import DrawFunReplyScreen from '../screens/DrawFunReplyScreen';
import MoodTrackerScreen from '../screens/MoodTrackerScreen';
import SharedListScreen from '../screens/SharedListScreen';
import AskQuestionScreen from '../screens/AskQuestionScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const [pendingCount, setPendingCount] = useState(0);
  const { socket } = useSocket();
  const { user } = useAuth();
  const { theme, isDarkMode } = useThemeContext();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const fetchRequestsCount = async () => {
    try {
      const responseReq = await axiosInstance.get('/pairing/requests');
      const responseNotif = await axiosInstance.get('/notifications');
      const unreadCount = responseNotif.data.filter(n => !n.read).length;
      setPendingCount(responseReq.data.length + unreadCount);
    } catch (error) {
      // ignore
    }
  };

  useEffect(() => {
    fetchRequestsCount();
    const interval = setInterval(fetchRequestsCount, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (socket && user) {
      const handleNewNotification = () => fetchRequestsCount();
      socket.on('receive_notification', handleNewNotification);
      
      const handleWatchInvite = ({ roomCode, roomId, hostName, hostId }) => {
        const targetHostId = hostId || (typeof user.partner === 'object' ? user.partner?._id : user.partner);
        Alert.alert(
          'Watch Room Invite 🍿',
          `${hostName || 'Your partner'} has invited you to watch something together!`,
          [
            { 
              text: 'Decline', 
              style: 'cancel',
              onPress: () => {
                socket.emit('reject_watch_invite', {
                  hostId: targetHostId,
                  roomCode,
                  guestName: user.fullName || user.username
                });
              }
            },
            { 
              text: 'Accept', 
              onPress: async () => {
                socket.emit('accept_watch_invite', {
                  hostId: targetHostId,
                  roomCode,
                  guestName: user.fullName || user.username
                });
                try {
                  const res = await axiosInstance.post('/watch/join', { roomCode });
                  const joinedRoom = res?.data?.room;
                  navigation.navigate('WatchRoom', {
                    roomCode: joinedRoom?.roomCode || roomCode,
                    roomId: joinedRoom?._id || roomId || roomCode,
                    isHost: false
                  });
                } catch (err) {
                  navigation.navigate('WatchRoom', {
                    roomCode,
                    roomId: roomId || roomCode,
                    isHost: false
                  });
                }
              }
            }
          ]
        );
      };
      socket.on('receive_watch_invite', handleWatchInvite);

      return () => {
        socket.off('receive_notification', handleNewNotification);
        socket.off('receive_watch_invite', handleWatchInvite);
      };
    }
  }, [socket, user, navigation]);

  return (
    <Tab.Navigator 
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: isDarkMode ? '#888888' : '#95a5a6',
        tabBarShowLabel: true,
        tabBarStyle: { 
          backgroundColor: theme.colors.card, 
          borderTopWidth: isDarkMode ? 1 : 0,
          borderTopColor: theme.colors.border,
          elevation: 20,
          shadowColor: '#ff6b81',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDarkMode ? 0.05 : 0.1,
          shadowRadius: 15,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          height: 65 + insets.bottom,
          paddingBottom: insets.bottom + 10,
          paddingTop: 10
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Chat') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Gallery') {
            iconName = focused ? 'images' : 'images-outline';
          } else if (route.name === 'Location') {
            iconName = focused ? 'location' : 'location-outline';
          } else if (route.name === 'Notification') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else if (route.name === 'More') {
            iconName = focused ? 'menu' : 'menu-outline';
          }
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Gallery" component={GalleryScreen} />
      <Tab.Screen name="Location" component={MapScreen} />
      <Tab.Screen 
        name="Notification" 
        component={NotificationScreen} 
        options={{ tabBarBadge: pendingCount > 0 ? pendingCount : null }}
      />
      <Tab.Screen name="More" component={MoreScreen} />
      <Tab.Screen name="Settings" component={SettingScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash || loading) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {user ? (
        // User is logged in
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Pairing" component={PairingScreen} />
          <Stack.Screen name="Conversation" component={ConversationScreen} />
          <Stack.Screen name="Feedback" component={FeedbackScreen} />
          <Stack.Screen name="PartnerProfile" component={PartnerProfileScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="DatesToRemember" component={DatesToRememberScreen} />
          <Stack.Screen name="WatchLobby" component={WatchLobbyScreen} />
          <Stack.Screen name="WatchRoom" component={WatchRoomScreen} />
          <Stack.Screen name="DrawFun" component={DrawFunScreen} />
          <Stack.Screen name="DrawFunReply" component={DrawFunReplyScreen} />
          <Stack.Screen name="MoodTracker" component={MoodTrackerScreen} />
          <Stack.Screen name="SharedList" component={SharedListScreen} />
          <Stack.Screen name="AskQuestion" component={AskQuestionScreen} />
          <Stack.Screen name="About" component={AboutScreen} />
          <Stack.Screen name="Policy" component={PolicyScreen} />
        </>
      ) : (
        // User is not logged in
        <>
          <Stack.Screen name="Intro" component={IntroScreen} />
          <Stack.Screen name="About" component={AboutScreen} />
          <Stack.Screen name="Policy" component={PolicyScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
