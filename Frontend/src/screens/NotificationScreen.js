import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
  ActivityIndicator,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance, { getMediaUrl } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import Toast from 'react-native-toast-message';

const formatNotificationDateTime = (dateValue) => {
  if (!dateValue) return '';
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return '';
  const datePart = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${datePart} • ${timePart}`;
};

export default function NotificationScreen() {
  const navigation = useNavigation();
  const { loadUser } = useAuth();
  const { theme, isDarkMode } = useThemeContext();
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchRequests = async () => {
    try {
      const response = await axiosInstance.get('/pairing/requests');
      setRequests(response.data);
    } catch (error) {
      console.log('Error fetching requests:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axiosInstance.get('/notifications');
      setNotifications(response.data);
    } catch (error) {
      console.log('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchNotifications();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchRequests(), fetchNotifications()]);
    setRefreshing(false);
  };

  const handleClearAll = () => {
    if (notifications.length === 0) {
      Toast.show({ type: 'info', text1: 'Already Empty', text2: 'There are no notifications to clear.' });
      return;
    }

    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications? Pending pairing requests will remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await axiosInstance.delete('/notifications/clear');
              setNotifications([]);
              DeviceEventEmitter.emit('notifications_updated');
              Toast.show({ type: 'success', text1: 'Cleared', text2: 'All notifications cleared.' });
            } catch (error) {
              console.log('Clear all error:', error);
              Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to clear notifications.' });
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const handleAccept = async (id) => {
    try {
      await axiosInstance.post(`/pairing/accept/${id}`);
      Toast.show({ type: 'success', text1: 'Accepted!', text2: 'Request accepted successfully.' });
      fetchRequests();
      if (loadUser) await loadUser();
    } catch (error) {
      console.log('Accept error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to accept request' });
    }
  };

  const handleReject = async (id) => {
    try {
      await axiosInstance.post(`/pairing/reject/${id}`);
      Toast.show({ type: 'success', text1: 'Rejected', text2: 'Request rejected.' });
      fetchRequests();
    } catch (error) {
      console.log('Reject error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to reject request' });
    }
  };

  const handleMarkAsRead = async (id, read) => {
    if (read) return;
    try {
      await axiosInstance.put(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
      DeviceEventEmitter.emit('notifications_updated');
    } catch (error) {
      console.log('Read error:', error);
    }
  };

  const renderItem = ({ item }) => {
    const formattedDateTime = formatNotificationDateTime(item.createdAt);

    if (item.viewType === 'request') {
      return (
        <View style={[styles.notificationCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary, borderWidth: 1 }]}>
          <View style={[styles.iconPlaceholder, { overflow: 'hidden' }]}>
            {item.sender?.avatar ? (
              <Image source={{ uri: getMediaUrl(item.sender.avatar) }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
            ) : (
              <Text style={styles.iconText}>💖</Text>
            )}
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Pairing Request</Text>
            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
              {item.sender?.fullName || item.sender?.username} (@{item.sender?.username}) wants to connect with you.
            </Text>
            <View style={styles.timestampRow}>
              <Ionicons name="time-outline" size={12} color={theme.colors.textSecondary} />
              <Text style={[styles.time, { color: theme.colors.textSecondary }]}>{formattedDateTime}</Text>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.acceptButton} onPress={() => handleAccept(item._id)}>
                <Text style={styles.buttonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rejectButton, { backgroundColor: theme.colors.inputBackground }]} onPress={() => handleReject(item._id)}>
                <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    } else {
      const unreadBg = isDarkMode ? 'rgba(255, 107, 129, 0.14)' : '#fff0f3';
      const unreadBorder = isDarkMode ? 'rgba(255, 107, 129, 0.35)' : '#ffd1dc';
      return (
        <TouchableOpacity
          style={[
            styles.notificationCard,
            item.read
              ? { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }
              : { backgroundColor: unreadBg, borderWidth: 1, borderColor: unreadBorder },
          ]
}
onPress = {() => {
  handleMarkAsRead(item._id, item.read);
  if (item.type === 'drawing' && item.referenceId) {
    navigation.navigate('DrawFunReply', { postId: item.referenceId });
  } else if (item.referenceId) {
    navigation.navigate('Home', { highlightPostId: item.referenceId });
  }
}}
        >
          <View style={styles.iconPlaceholder}>
            <Text style={styles.iconText}>
              {item.type === 'gallery' ? '📸' : item.type === 'like' ? '❤️' : item.type === 'comment' ? '💬' : item.type === 'drawing' ? '🎨' : '🔔'}
            </Text>
          </View>
          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>{item.message}</Text>
            <View style={styles.timestampRow}>
              <Ionicons name="time-outline" size={12} color={theme.colors.textSecondary} />
              <Text style={[styles.time, { color: theme.colors.textSecondary }]}>{formattedDateTime}</Text>
            </View>
          </View>
        </TouchableOpacity >
      );
    }
  };

const combinedData = [
    ...requests.map((r) => ({ ...r, viewType: 'request' })),
    ...notifications.map((n) => ({ ...n, viewType: 'notification' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

return (
  <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Notifications</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconActionBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons name="refresh" size={20} color={theme.colors.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.clearAllBtn, { backgroundColor: 'rgba(255, 71, 87, 0.12)', borderColor: 'rgba(255, 71, 87, 0.3)' }]}
            onPress={handleClearAll}
            disabled={clearing || notifications.length === 0}
          >
            {clearing ? (
              <ActivityIndicator size="small" color="#ff4757" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color="#ff4757" />
                <Text style={styles.clearAllText}>Clear All</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={combinedData}
        keyExtractor={(item) => `${item.viewType}_${item._id}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={52} color={theme.colors.textSecondary} style={{ opacity: 0.5, marginBottom: 12 }} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No new notifications</Text>
          </View>
        }
      />
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
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  clearAllText: {
    color: '#ff4757',
    fontSize: 13,
    fontWeight: '700',
  },
  listContainer: {
    padding: 18,
    paddingBottom: 40,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 15,
    borderRadius: 16,
    marginBottom: 12,
  },
  iconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 107, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  iconText: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff6b81',
  },
  description: {
    fontSize: 14,
    lineHeight: 19,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 5,
  },
  time: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
  },
  acceptButton: {
    backgroundColor: '#ff6b81',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  rejectButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 70,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
},
});
