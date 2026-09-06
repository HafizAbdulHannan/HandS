import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import axiosInstance from '../api/axiosConfig';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingScreen() {
  const navigation = useNavigation();
  const { user, logout, loadUser } = useAuth();
  const { isDarkMode, toggleTheme, theme } = useThemeContext();
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const UPDATE_DRIVE_ID = "1LhJ2M_SU0DmY7cAyXg8ZhywHRlgxQkt7";
  const DRIVE_DOWNLOAD_URL = `https://drive.google.com/uc?export=download&id=${UPDATE_DRIVE_ID}`;

  const handleLogout = async () => {
    await logout();
  };

  const handleUnpair = () => {
    Alert.alert(
      "Disconnect Partner",
      "Are you sure you want to disconnect from your partner? You will no longer see their posts or be able to chat with them.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Disconnect", 
          style: "destructive",
          onPress: async () => {
            try {
              await axiosInstance.post('/pairing/disconnect');
              await loadUser();
              Toast.show({ type: 'success', text1: 'Success', text2: 'Disconnected from partner' });
            } catch (error) {
              console.log('Disconnect error:', error);
              Toast.show({ type: 'error', text1: 'Error', text2: 'Could not disconnect' });
            }
          }
        }
      ]
    );
  };

  const handleCameraAccess = () => {
    Linking.openSettings();
  };

  const handleDownloadUpdate = async () => {
    try {
      // Direct downloading via FileSystem often fails with Google Drive because of virus scan warning pages.
      // Opening the URL in the browser allows the user to download it reliably.
      Toast.show({ type: 'info', text1: 'Redirecting', text2: 'Opening browser to download update...' });
      await Linking.openURL(`https://drive.google.com/file/d/${UPDATE_DRIVE_ID}/view?usp=sharing`);
    } catch (error) {
      console.log('Update Error:', error);
      Toast.show({ type: 'error', text1: 'Update Failed', text2: 'Could not open the download link.' });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Settings</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.menuContainer, { backgroundColor: theme.colors.card }]}>
          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
            onPress={() => navigation.navigate('Feedback')}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Provide Feedback</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
            onPress={toggleTheme}
          >
            <Ionicons name={isDarkMode ? "sunny-outline" : "moon-outline"} size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>{isDarkMode ? "Light Mode" : "Dark Mode"}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
            onPress={() => {
              navigation.navigate('Location');
            }}
          >
            <Ionicons name="location-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Location Sharing</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
            onPress={handleCameraAccess}
          >
            <Ionicons name="camera-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Camera Access</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
            onPress={() => navigation.navigate('Policy')}
          >
            <Ionicons name="document-text-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Our Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
            onPress={() => navigation.navigate('About')}
          >
            <Ionicons name="information-circle-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>About Us</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
            onPress={handleDownloadUpdate}
            disabled={isDownloading}
          >
            <Ionicons name="cloud-download-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuText, { color: theme.colors.text }]}>Download Update</Text>
              {isDownloading && (
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBar, { width: `${downloadProgress * 100}%` }]} />
                </View>
              )}
            </View>
            {isDownloading && <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{Math.round(downloadProgress * 100)}%</Text>}
          </TouchableOpacity>

          {user?.partner && (
            <TouchableOpacity 
              style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
              onPress={handleUnpair}
            >
              <Ionicons name="heart-dislike-outline" size={22} color="#ff9f43" style={styles.menuIcon} />
              <Text style={[styles.menuText, { color: '#ff9f43' }]}>Disconnect Partner</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Log Out</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomWidth: 0 }]} 
            onPress={() => {}}
          >
            <Ionicons name="trash-outline" size={22} color="#ff4757" style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: '#ff4757' }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  menuContainer: {
    borderRadius: 15,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    marginTop: 8,
    width: '90%',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#ff6b81',
  }
});
