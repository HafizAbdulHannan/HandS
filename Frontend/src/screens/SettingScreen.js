import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, ScrollView, ActivityIndicator, Modal, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import axiosInstance, { getMediaUrl } from '../api/axiosConfig';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function SettingScreen() {
  const navigation = useNavigation();
  const { user, logout, loadUser, deleteCurrentAccount } = useAuth();
  const { isDarkMode, toggleTheme, theme } = useThemeContext();
  const [partner, setPartner] = useState(null);

  // Delete account modal state
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteReason, setDeleteReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloadingData, setIsDownloadingData] = useState(false);

  const UPDATE_DRIVE_ID = "1LhJ2M_SU0DmY7cAyXg8ZhywHRlgxQkt7";

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
              await axiosInstance.post('/pairing/unpair');
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
      const bytes = new Uint8Array(response.data);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const sub = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, sub);
      }
      const base64 = btoa(binary);

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
      const finalReason = deleteReason === "Others" ? otherReason : deleteReason;
      await deleteCurrentAccount(deletePassword, finalReason);
      setIsDeleteModalVisible(false);
      Toast.show({ type: 'success', text1: 'Deleted', text2: 'Your account has been deleted.' });
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Overview Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <TouchableOpacity
            style={styles.profileCardTop}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            <View style={styles.profileAvatarContainer}>
              {user?.avatar ? (
                <Image source={{ uri: getMediaUrl(user.avatar) }} style={styles.profileAvatarImage} />
              ) : (
                <Text style={styles.profileAvatarInitial}>
                  {(user?.fullName || user?.username || 'U').charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.colors.text }]} numberOfLines={1}>
                {user?.fullName || user?.username || 'User'}
              </Text>
              <Text style={[styles.profileUsername, { color: theme.colors.primary }]} numberOfLines={1}>
                @{user?.username || 'user'}
              </Text>
              {user?.email ? (
                <Text style={[styles.profileEmail, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {user.email}
                </Text>
              ) : null}
              {user?.bio ? (
                <Text style={[styles.profileBio, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                  {user.bio}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.profileActionsRow, { borderTopColor: theme.colors.border }]}>
            <TouchableOpacity
              style={[styles.profileActionBtn, { backgroundColor: theme.colors.inputBackground }]}
              onPress={() => navigation.navigate('Profile')}
            >
              <Ionicons name="person-outline" size={16} color={theme.colors.text} />
              <Text style={[styles.profileActionText, { color: theme.colors.text }]}>View Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.profileActionBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => navigation.navigate('ManageAccount')}
            >
              <Ionicons name="settings-outline" size={16} color="#fff" />
              <Text style={[styles.profileActionText, { color: '#fff' }]}>Manage Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.menuContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
            onPress={() => navigation.navigate('Feedback')}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Provide Feedback</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
            onPress={() => navigation.navigate('AskQuestion')}
          >
            <Ionicons name="help-circle-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Ask a Question</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
            onPress={toggleTheme}
          >
            <Ionicons name={isDarkMode ? "sunny-outline" : "moon-outline"} size={22} color={theme.colors.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>{isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}</Text>
            <Ionicons name="swap-horizontal-outline" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
            onPress={() => navigation.navigate('Location')}
          >
            <Ionicons name="location-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Location Sharing</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
            onPress={handleCameraAccess}
          >
            <Ionicons name="camera-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Camera & Mic Permissions</Text>
            <Ionicons name="open-outline" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
            onPress={() => navigation.navigate('Policy')}
          >
            <Ionicons name="document-text-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Our Policy</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
            onPress={() => navigation.navigate('About')}
          >
            <Ionicons name="information-circle-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>About Us</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
            onPress={handleDownloadUpdate}
          >
            <Ionicons name="cloud-download-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Download App Update</Text>
            <Ionicons name="open-outline" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          {user?.partner && (
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: theme.colors.border, borderColor: 'rgba(255, 71, 87, 0.35)', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginTop: 12, marginBottom: 12 }]}
              onPress={handleUnpair}
            >
              <View style={styles.partnerAvatarContainer}>
                {partner?.avatar ? (
                  <Image source={{ uri: getMediaUrl(partner.avatar) }} style={styles.partnerAvatar} />
                ) : (
                  <Text style={styles.partnerAvatarInitial}>{partner?.username?.charAt(0).toUpperCase() || 'P'}</Text>
                )}
              </View>
              <Text style={[styles.menuText, { color: '#ff4757' }]}>
                Disconnect Partner {partner?.username ? `(@${partner.username})` : ''}
              </Text>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
                    We're sorry to see you go. Could you tell us your reason for leaving?
                  </Text>

                  <TouchableOpacity
                    style={[styles.dropdownSelector, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}
                    onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownText, { color: deleteReason ? theme.colors.text : theme.colors.textSecondary }]}>
                      {deleteReason || "Select a reason"}
                    </Text>
                    <Ionicons name={isDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>

                  {isDropdownOpen && (
                    <View style={[styles.dropdownList, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                      {["I'm bored", "I wanna create new account", "I don't like this anymore", "Others"].map((reason, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[styles.dropdownItem, { borderBottomColor: index < 3 ? theme.colors.border : 'transparent' }]}
                          onPress={() => {
                            setDeleteReason(reason);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <Text style={{ color: theme.colors.text }}>{reason}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {deleteReason === "Others" && (
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, marginTop: 15, marginBottom: 0 }]}
                      placeholder="Please specify..."
                      placeholderTextColor={theme.colors.textSecondary}
                      value={otherReason}
                      onChangeText={setOtherReason}
                      multiline
                    />
                  )}

                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: '#ff6b81', marginTop: isDropdownOpen ? 15 : 20 }]}
                    onPress={() => {
                      if (deleteReason === "Others" && !otherReason.trim()) {
                        Toast.show({ type: 'error', text1: 'Required', text2: 'Please specify your reason' });
                        return;
                      }
                      if (deleteReason) setDeleteStep(2);
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
                  <View style={[styles.passwordContainer, { backgroundColor: theme.colors.inputBackground }]}>
                    <TextInput
                      style={[styles.passwordInput, { color: theme.colors.text }]}
                      placeholder="Password"
                      placeholderTextColor={theme.colors.textSecondary}
                      secureTextEntry={!showPassword}
                      value={deletePassword}
                      onChangeText={setDeletePassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: '#ff6b81', marginTop: 10 }]}
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
          </ScrollView>
        </KeyboardAvoidingView>
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
    fontSize: 24,
    fontWeight: '800',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  profileCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  profileCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ff6b81',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  profileAvatarInitial: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
    marginRight: 8,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileUsername: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 1,
  },
  profileEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  profileBio: {
    fontSize: 13,
    marginTop: 4,
  },
  profileActionsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
    gap: 10,
  },
  profileActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  profileActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  menuContainer: {
    borderRadius: 18,
    paddingHorizontal: 15,
    borderWidth: 1,
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
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
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
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    marginHorizontal: 20,
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
  dropdownSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 15,
    minHeight: 50,
  },
  dropdownText: {
    fontSize: 15,
  },
  dropdownList: {
    marginTop: 5,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 20,
    minHeight: 50,
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 15,
  },
  eyeIcon: {
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
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
