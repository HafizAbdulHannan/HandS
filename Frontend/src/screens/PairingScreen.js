import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance, { getMediaUrl } from '../api/axiosConfig';
import { useThemeContext } from '../context/ThemeContext';
import Toast from 'react-native-toast-message';

export default function PairingScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingUserId, setLoadingUserId] = useState(null);
  const [sentRequests, setSentRequests] = useState([]);
  const navigation = useNavigation();
  const { theme } = useThemeContext();

  const handleSearch = async () => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await axiosInstance.get(`/pairing/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchResults(response.data);
    } catch (error) {
      console.log('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={26} color={theme.colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.title, { color: theme.colors.text }]}>Connect Partner</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Search by username or email to link your accounts</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <View style={[styles.inputWrapper, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
            <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput 
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Search partner..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              onSubmitEditing={handleSearch}
            />
          </View>
          <TouchableOpacity style={styles.searchButton} activeOpacity={0.8} onPress={handleSearch} disabled={isSearching}>
            {isSearching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        <FlatList
          data={searchResults}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            searchQuery.trim() !== '' && !isSearching ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🙈</Text>
                <Text style={[styles.emptyText, { color: theme.colors.text }]}>No results found.</Text>
                <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>Make sure the username or email is correct.</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={[styles.userCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.userInfo}>
                <View style={[styles.avatarPlaceholder, { overflow: 'hidden' }]}>
                  {item.avatar ? (
                    <Image source={{ uri: getMediaUrl(item.avatar) }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                  ) : (
                    <Text style={styles.avatarText}>{(item.username || 'U').charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.textContainer}>
                  <Text style={[styles.username, { color: theme.colors.text }]} numberOfLines={1}>
                    {item.fullName || item.username}
                  </Text>
                  <Text style={[styles.email, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    @{item.username} • {item.email}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={[
                  styles.connectButton, 
                  (sentRequests.includes(item._id) || item.partner) && styles.connectButtonDisabled
                ]}
                activeOpacity={0.8}
                onPress={() => handleSendRequest(item._id)}
                disabled={sentRequests.includes(item._id) || !!item.partner || loadingUserId === item._id}
              >
                {loadingUserId === item._id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.connectButtonText}>
                    {item.partner ? 'Paired' : sentRequests.includes(item._id) ? 'Sent' : 'Connect'}
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
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    marginBottom: 20,
  },
  backBtn: {
    marginBottom: 12,
    alignSelf: 'flex-start',
    padding: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
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
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#ff6b81',
    paddingHorizontal: 20,
    paddingVertical: 15,
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
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
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
    backgroundColor: 'rgba(255, 107, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#ff6b81',
    fontSize: 22,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  email: {
    fontSize: 13,
  },
  connectButton: {
    backgroundColor: '#ff6b81',
    paddingHorizontal: 18,
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
