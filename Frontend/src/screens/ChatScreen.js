import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import axiosInstance, { STATIC_URL } from '../api/axiosConfig';

export default function ChatScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPartner = async () => {
      if (!user?.partner) {
        setLoading(false);
        return;
      }
      try {
        const response = await axiosInstance.get('/pairing/partner');
        setPartner(response.data);
      } catch (error) {
        console.log('Error fetching partner:', error);
      } finally {
        setLoading(false);
      }
    };
    
    // Refresh partner info when screen is focused
    const unsubscribe = navigation.addListener('focus', () => {
      fetchPartner();
    });

    fetchPartner();
    return unsubscribe;
  }, [navigation, user?.partner]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ff6b81" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
      </View>

      {!user?.partner || !partner ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>👻</Text>
          <Text style={styles.emptyText}>No Partner Connected</Text>
          <Text style={styles.emptySubtext}>You need to pair with a partner to start chatting.</Text>
          
          <TouchableOpacity 
            style={styles.pairButton}
            onPress={() => navigation.navigate('Pairing')}
          >
            <Text style={styles.pairButtonText}>Connect with Partner</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.listContainer}>
          <Animated.View entering={FadeInUp.delay(100)} layout={Layout.springify()}>
            <TouchableOpacity 
              style={styles.chatCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Conversation', { partner })}
          >
            <View style={[styles.avatarPlaceholder, { overflow: 'hidden' }]}>
              {partner.avatar ? (
                <Image source={{ uri: `${STATIC_URL}${partner.avatar}` }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
              ) : (
                <Text style={styles.avatarLetter}>{partner.username.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.chatInfo}>
              <Text style={styles.chatName}>{partner.username}</Text>
              <Text style={styles.chatPreview}>Tap to open chat</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcfcfc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fcfcfc',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: '#fcfcfc',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 30,
  },
  pairButton: {
    backgroundColor: '#ff6b81',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    shadowColor: '#ff6b81',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  pairButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ff6b81',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  chatPreview: {
    fontSize: 14,
    color: '#888',
  }
});
