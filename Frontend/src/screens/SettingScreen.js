import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, ScrollView, ActivityIndicator, Modal, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import axiosInstance, { getMediaUrl, STATIC_URL } from '../api/axiosConfig';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingScreen() {
  const navigation = useNavigation();
  const { user, logout, loadUser } = useAuth();
  const { isDarkMode, toggleTheme, theme } = useThemeContext();
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [partner, setPartner] = useState(null);

  // Delete account modal state
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloadingData, setIsDownloadingData] = useState(false);

  const UPDATE_DRIVE_ID = "1LhJ2M_SU0DmY7cAyXg8ZhywHRlgxQkt7";
  const DRIVE_DOWNLOAD_URL = `https://drive.google.com/uc?export=download&id=${UPDATE_DRIVE_ID}`;

  useEffect(() => {
    const fetchPartner = async () => {
      if (user?.partner) {
        try {
          const response = await axiosInstance.get('/pairing/partner');
          setPartner(response.data);
        } catch (error) {
          console.log('Error fetching partner:', error);
        }
      } else {
        setPartner(null);
      }
    };
    fetchPartner();
  }, [user?.partner]);

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

  const handleDownloadData = async () => {
    try {
      setIsDownloadingData(true);
      const response = await axiosInstance.get('/auth/download-data', {
        responseType: 'arraybuffer'
      });
      
      const fileUri = FileSystem.documentDirectory + 'HandS_UserData.zip';
      const base64 = btoa(
        new Uint8Array(response.data).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          '',
        )
      );
      
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Toast.show({ type: 'success', text1: 'Downloaded', text2: 'Data saved to your device' });
      }
    } catch (error) {
      console.log('Download data error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not download your data' });
    } finally {
      setIsDownloadingData(false);
    }
  };

  const handleFinalDelete = async () => {
    try {
      setIsDeleting(true);
      await axiosInstance.post('/auth/delete-account', {
        reason: deleteReason,
        password: deletePassword
      });
      setIsDeleteModalVisible(false);
      Toast.show({ type: 'success', text1: 'Deleted', text2: 'Your account has been deleted.' });
      await logout();
    } catch (error) {
      console.log('Delete account error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Could not delete account. Check password.' });
      setIsDeleting(false);
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
              style={[styles.menuItem, { borderBottomColor: theme.colors.border, borderColor: 'rgba(255, 71, 87, 0.3)', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, marginTop: 10, marginBottom: 10 }]} 
              onPress={handleUnpair}
            >
              <View style={styles.partnerAvatarContainer}>
                {partner?.avatar ? (
                  <Image source={{ uri: getMediaUrl(partner.avatar) }} style={styles.partnerAvatar} />
                ) : (
                  <Text style={styles.partnerAvatarInitial}>{partner?.username?.charAt(0).toUpperCase() || 'P'}</Text>
                )}
              </View>
              <Text style={[styles.menuText, { color: '#ff4757', flex: 1 }]}>Disconnect Partner</Text>
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
            onPress={() => {
              setDeleteStep(1);
              setDeleteReason('');
              setDeletePassword('');
              setIsDeleteModalVisible(true);
            }}
          >
            <Ionicons name="trash-outline" size={22} color="#ff4757" style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: '#ff4757' }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Delete Account Modal */}
      <Modal
        visible={isDeleteModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Delete Account</Text>
              <TouchableOpacity onPress={() => setIsDeleteModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {deleteStep === 1 && (
              <View>
                <Text style={[styles.modalInstruction, { color: theme.colors.textSecondary }]}>
                  We're sorry to see you go. Could you tell us your professional reason for leaving?
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                  placeholder="Professional Reason"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={deleteReason}
                  onChangeText={setDeleteReason}
                  multiline
                />
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: '#ff6b81' }]} 
                  onPress={() => {
                    if (deleteReason.trim()) setDeleteStep(2);
                    else Toast.show({ type: 'error', text1: 'Required', text2: 'Please provide a reason' });
                  }}
                >
                  <Text style={styles.modalButtonText}>Next</Text>
                </TouchableOpacity>
              </View>
            )}

            {deleteStep === 2 && (
              <View>
                <Text style={[styles.modalInstruction, { color: theme.colors.textSecondary }]}>
                  Confirm it's you by entering your password.
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                  placeholder="Password"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                />
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: '#ff6b81' }]} 
                  onPress={() => {
                    if (deletePassword.trim()) setDeleteStep(3);
                    else Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter your password' });
                  }}
                >
                  <Text style={styles.modalButtonText}>Next</Text>
                </TouchableOpacity>
              </View>
            )}

            {deleteStep === 3 && (
              <View>
                <Text style={[styles.modalInstruction, { color: theme.colors.textSecondary }]}>
                  Before you go, would you like to download your data? This includes a text file of your posts and folders for all your uploaded images and gallery.
                </Text>
                
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: '#45aaf2', marginBottom: 15 }]} 
                  onPress={handleDownloadData}
                  disabled={isDownloadingData}
                >
                  {isDownloadingData ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalButtonText}>Download your data</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: '#ff4757' }]} 
                  onPress={handleFinalDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalButtonText}>Delete Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  },
  partnerAvatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ff6b81',
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  partnerAvatar: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  partnerAvatarInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalInstruction: {
    fontSize: 15,
    marginBottom: 15,
    lineHeight: 22,
  },
  modalInput: {
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    marginBottom: 20,
    minHeight: 50,
  },
  modalButton: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  }
});
