import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import axiosInstance, { getMediaUrl } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import Toast from 'react-native-toast-message';

export default function NotificationScreen() {
  const navigation = useNavigation();
  const { loadUser } = useAuth();
  const { theme, isDarkMode } = useThemeContext();
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

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
    await fetchRequests();
    await fetchNotifications();
    setRefreshing(false);
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
      setNotifications(notifications.map(n => n._id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.log('Read error:', error);
    }
  };

  const renderItem = ({ item }) => {
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
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.acceptButton} onPress={() => handleAccept(item._id)}>
                <Text style={styles.buttonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rejectButton, { backgroundColor: theme.colors.inputBackground }]} onPress={() => handleReject(item._id)}>
                <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.time, { color: theme.colors.textSecondary }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
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
              : { backgroundColor: unreadBg, borderWidth: 1, borderColor: unreadBorder }
          ]}
          onPress={() => {
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
              {item.type === 'gallery' ? '📸' : item.type === 'like' ? '❤️' : item.type === 'comment' ? '💬' : item.type === 'drawing' ? '🎨' : '📝'}
            </Text>
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{item.title}</Text>
            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>{item.message}</Text>
          </View>
          <Text style={[styles.time, { color: theme.colors.textSecondary }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </TouchableOpacity>
      );
    }
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const combinedData = [
    ...requests.map(r => ({ ...r, viewType: 'request' })),
    ...notifications.map(n => ({ ...n, viewType: 'notification' }))
  ].filter(item => {
    if (item.viewType === 'request') return true;
    if (!item.read) return true;
    const itemDate = new Date(item.createdAt);
    return itemDate >= todayStart;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Notifications</Text>
      </View>
      <FlatList
        data={combinedData}
        keyExtractor={item => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  listContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
  },
  iconText: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
    paddingRight: 50,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
  },
  time: {
    fontSize: 11,
    position: 'absolute',
    top: 16,
    right: 16,
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
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
  }
});
