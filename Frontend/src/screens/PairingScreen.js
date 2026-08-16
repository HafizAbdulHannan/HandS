import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import axiosInstance from '../api/axiosConfig';
import Toast from 'react-native-toast-message';

export default function PairingScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingUserId, setLoadingUserId] = useState(null);
  const [sentRequests, setSentRequests] = useState([]);
  const navigation = useNavigation();

  const handleSearch = async () => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    try {
      const response = await axiosInstance.get(`/pairing/search?q=${searchQuery}`);
      setSearchResults(response.data);
    } catch (error) {
      console.log('Search error:', error);
      setSearchResults([]);
    }
  };

  const handleSendRequest = async (userId) => {
    setLoadingUserId(userId);
    try {
      await axiosInstance.post('/pairing/request', { receiverId: userId });
      setSentRequests(prev => [...prev, userId]);
      Toast.show({ type: 'success', text1: 'Sent!', text2: 'Your connection request has been sent!' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Error sending request' });
    } finally {
      setLoadingUserId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Our Space</Text>
          <Text style={styles.subtitle}>Link with your partner</Text>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.inputWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput 
              style={styles.input}
              placeholder="Search partner..."
              placeholderTextColor="#aaa"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              onSubmitEditing={handleSearch}
            />
          </View>
          <TouchableOpacity style={styles.searchButton} activeOpacity={0.8} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={searchResults}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            searchQuery.trim() !== '' ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🙈</Text>
                <Text style={styles.emptyText}>No results found.</Text>
                <Text style={styles.emptySubtext}>Make sure the username or email is correct.</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.userInfo}>
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.username} numberOfLines={1}>{item.username}</Text>
                  <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={[
                  styles.connectButton, 
                  sentRequests.includes(item._id) && styles.connectButtonDisabled
                ]}
                activeOpacity={0.8}
                onPress={() => handleSendRequest(item._id)}
                disabled={sentRequests.includes(item._id) || loadingUserId === item._id}
              >
                {loadingUserId === item._id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.connectButtonText}>
                    {sentRequests.includes(item._id) ? 'Sent' : 'Connect'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        />
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 40,
    marginBottom: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 20,
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    paddingHorizontal: 16,
    marginRight: 12,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  searchButton: {
    backgroundColor: '#ff6b81',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff6b81',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 50,
    marginBottom: 16,
  },
  emptyText: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff0f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#ff6b81',
    fontSize: 22,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  email: {
    fontSize: 14,
    color: '#888',
  },
  connectButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#888',
  },
  connectButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  }
});
