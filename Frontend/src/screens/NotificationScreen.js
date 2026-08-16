import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import axiosInstance from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import Toast from 'react-native-toast-message';

export default function NotificationScreen() {
  const navigation = useNavigation();
  const { loadUser } = useAuth();
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
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to accept request' });
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
        <View style={styles.notificationCard}>
          <View style={styles.iconPlaceholder}>
            <Text style={styles.iconText}>💖</Text>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Pairing Request</Text>
            <Text style={styles.description}>{item.sender?.username} wants to connect with you.</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.acceptButton} onPress={() => handleAccept(item._id)}>
                <Text style={styles.buttonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectButton} onPress={() => handleReject(item._id)}>
                <Text style={styles.buttonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.time}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
      );
    } else {
      return (
        <TouchableOpacity 
          style={[styles.notificationCard, item.read ? styles.readCard : styles.unreadCard]}
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
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.message}</Text>
          </View>
          <Text style={styles.time}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </TouchableOpacity>
      );
    }
  };

  const combinedData = [
    ...requests.map(r => ({ ...r, viewType: 'request' })),
    ...notifications.map(n => ({ ...n, viewType: 'notification' }))
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>
      <FlatList
        data={combinedData}
        keyExtractor={item => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No new notifications</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
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
  readCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  unreadCard: {
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#cce4ff',
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffeaa7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
  time: {
    fontSize: 12,
    color: '#aaa',
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
    backgroundColor: '#ddd',
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
    color: '#888',
    fontSize: 16,
  }
});
