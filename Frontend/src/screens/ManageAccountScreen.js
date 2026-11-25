import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import axiosInstance, { getMediaUrl } from '../api/axiosConfig';

export default function ManageAccountScreen() {
  const navigation = useNavigation();
  const { user, savedAccounts, switchAccount, removeSavedAccount, deleteCurrentAccount, logout } = useAuth();
  const { theme } = useThemeContext();

  const [partner, setPartner] = useState(null);
  const [showAccountDetails, setShowAccountDetails] = useState(true);
  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState(null);

  // Delete current account modal state
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteReason, setDeleteReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloadingData, setIsDownloadingData] = useState(false);

  useEffect(() => {
    const fetchPartner = async () => {
      if (user?.partner) {
        try {
          const res = await axiosInstance.get('/pairing/partner');
          setPartner(res.data);
        } catch (e) {}
      } else {
        setPartner(null);
      }
    };
    fetchPartner();
  }, [user?.partner, user?._id]);

  const otherAccounts = (savedAccounts || []).filter((acc) => String(acc._id) !== String(user?._id));

  const handleSwitchToAccount = async (account) => {
    if (!account?._id || String(account._id) === String(user?._id)) {
      setSwitchModalVisible(false);
      return;
    }
    setSwitchingAccountId(account._id);
    try {
      await switchAccount(account._id);
      setSwitchModalVisible(false);
      Toast.show({
        type: 'success',
        text1: 'Account Switched',
        text2: `Logged in as @${account.username || account.email}`,
      });
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Re-login Needed',
        text2: error?.message || 'Please enter password to sign in to this account.',
      });
      setSwitchModalVisible(false);
      navigation.navigate('AddAccountLogin', { isAddingAccount: true, prefillEmail: account.email });
    } finally {
      setSwitchingAccountId(null);
    }
  };

  const handleRemoveSaved = (account) => {
    Alert.alert(
      'Remove Account',
      `Remove @${account.username || account.email} from saved accounts on this device?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeSavedAccount(account._id);
            Toast.show({ type: 'info', text1: 'Removed', text2: 'Account removed from device list.' });
          },
        },
      ]
    );
  };

  const handleLogoutCurrent = () => {
    Alert.alert(
      'Logout',
      `Log out of @${user?.username || 'this account'}? Your saved accounts will stay available on the Login screen.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleDownloadData = async () => {
    try {
      setIsDownloadingData(true);
      const response = await axiosInstance.get('/auth/download-data', { responseType: 'arraybuffer' });
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
        Toast.show({ type: 'success', text1: 'Downloaded', text2: 'Data saved to your device.' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not download your data.' });
    } finally {
      setIsDownloadingData(false);
    }
  };

  const handleFinalDelete = async () => {
    if (!deletePassword.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter your password.' });
      return;
    }
    try {
      setIsDeleting(true);
      const finalReason = deleteReason === 'Others' ? otherReason : deleteReason;
      await deleteCurrentAccount(deletePassword, finalReason);
      setIsDeleteModalVisible(false);
      Toast.show({ type: 'success', text1: 'Account Deleted', text2: 'Your current account has been permanently deleted.' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Delete Failed',
        text2: error.response?.data?.message || 'Incorrect password or error deleting account.',
      });
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Manage Account</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 1. Account Details Section */}
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowAccountDetails((prev) => !prev)}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIconBox, { backgroundColor: 'rgba(255, 107, 129, 0.14)' }]}>
                <Ionicons name="person-circle-outline" size={22} color="#ff6b81" />
              </View>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account Details</Text>
                <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>
                  Currently logged in as @{user?.username}
                </Text>
              </View>
            </View>
            <Ionicons name={showAccountDetails ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          {showAccountDetails && (
            <View style={[styles.detailsBody, { borderTopColor: theme.colors.border }]}>
              <View style={styles.avatarHeaderRow}>
                <View style={styles.avatarCircle}>
                  {user?.avatar ? (
                    <Image source={{ uri: getMediaUrl(user.avatar) }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarInitial}>{(user?.fullName || user?.username || 'U').charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailHeroName, { color: theme.colors.text }]}>{user?.fullName || 'Not set'}</Text>
                  <Text style={[styles.detailHeroUser, { color: theme.colors.primary }]}>@{user?.username}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.editMiniBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() => navigation.navigate('EditProfile')}
                >
                  <Ionicons name="create-outline" size={15} color="#fff" />
                  <Text style={styles.editMiniText}>Edit</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.detailItemRow, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Full Name</Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>{user?.fullName || '-'}</Text>
              </View>
              <View style={[styles.detailItemRow, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Username</Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>@{user?.username || '-'}</Text>
              </View>
              <View style={[styles.detailItemRow, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Email</Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]} numberOfLines={1}>{user?.email || '-'}</Text>
              </View>
              <View style={[styles.detailItemRow, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Phone</Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>{user?.phoneNumber || '-'}</Text>
              </View>
              <View style={[styles.detailItemRow, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Bio</Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>{user?.bio || 'No bio added'}</Text>
              </View>
              <View style={[styles.detailItemRow, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Partner</Text>
                <Text style={[styles.detailValue, { color: partner ? theme.colors.primary : theme.colors.textSecondary }]}>
                  {partner ? `${partner.fullName || partner.username} (@${partner.username})` : 'Not Connected'}
                </Text>
              </View>
              {user?.createdAt ? (
                <View style={[styles.detailItemRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Member Since</Text>
                  <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                    {new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* 2. Other Accounts & Switch Between Accounts */}
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIconBox, { backgroundColor: 'rgba(69, 170, 242, 0.14)' }]}>
                <Ionicons name="people-outline" size={22} color="#45aaf2" />
              </View>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Other Accounts</Text>
                <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>
                  {otherAccounts.length} other saved {otherAccounts.length === 1 ? 'account' : 'accounts'} on this device
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.otherBody, { borderTopColor: theme.colors.border }]}>
            <TouchableOpacity
              style={[styles.switchMainBtn, { backgroundColor: 'rgba(69, 170, 242, 0.14)', borderColor: 'rgba(69, 170, 242, 0.35)' }]}
              onPress={() => setSwitchModalVisible(true)}
            >
              <Ionicons name="swap-horizontal" size={20} color="#45aaf2" />
              <Text style={[styles.switchMainBtnText, { color: '#45aaf2' }]}>Switch Between Accounts</Text>
              <Ionicons name="chevron-forward" size={18} color="#45aaf2" />
            </TouchableOpacity>

            {otherAccounts.length > 0 ? (
              otherAccounts.map((acc) => (
                <View
                  key={acc._id}
                  style={[styles.accountRow, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}
                >
                  <TouchableOpacity
                    style={styles.accountRowLeft}
                    onPress={() => handleSwitchToAccount(acc)}
                    disabled={switchingAccountId === acc._id}
                  >
                    <View style={styles.smallAvatar}>
                      {acc.avatar ? (
                        <Image source={{ uri: getMediaUrl(acc.avatar) }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.smallAvatarInitial}>
                          {(acc.fullName || acc.username || 'U').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.accName, { color: theme.colors.text }]} numberOfLines={1}>
                        {acc.fullName || acc.username}
                      </Text>
                      <Text style={[styles.accSub, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        @{acc.username} • {acc.email}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.accountRowActions}>
                    <TouchableOpacity
                      style={[styles.switchPillBtn, { backgroundColor: theme.colors.primary }]}
                      onPress={() => handleSwitchToAccount(acc)}
                      disabled={switchingAccountId === acc._id}
                    >
                      {switchingAccountId === acc._id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.switchPillText}>Switch</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.removeMiniBtn} onPress={() => handleRemoveSaved(acc)}>
                      <Ionicons name="close-circle-outline" size={20} color="#ff4757" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.noOtherText, { color: theme.colors.textSecondary }]}>
                No other accounts saved yet. Tap "Add Account" below to sign in or create another account.
              </Text>
            )}
          </View>
        </View>

        {/* 3. Account Actions (Add Account, Logout, Delete Current Account) */}
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.actionMenuItem, { borderBottomColor: theme.colors.border }]}
            onPress={() => navigation.navigate('AddAccountLogin', { isAddingAccount: true })}
          >
            <View style={[styles.sectionIconBox, { backgroundColor: 'rgba(43, 203, 186, 0.14)' }]}>
              <Ionicons name="person-add-outline" size={21} color="#2bcbba" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Add Account</Text>
              <Text style={[styles.actionSub, { color: theme.colors.textSecondary }]}>
                Log in to an existing account or create a new one
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionMenuItem, { borderBottomColor: theme.colors.border }]}
            onPress={handleLogoutCurrent}
          >
            <View style={[styles.sectionIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
              <Ionicons name="log-out-outline" size={21} color="#f59e0b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Logout</Text>
              <Text style={[styles.actionSub, { color: theme.colors.textSecondary }]}>
                Sign out from @{user?.username}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionMenuItem, { borderBottomWidth: 0 }]}
            onPress={() => {
              setDeleteStep(1);
              setDeleteReason('');
              setOtherReason('');
              setDeletePassword('');
              setIsDeleteModalVisible(true);
            }}
          >
            <View style={[styles.sectionIconBox, { backgroundColor: 'rgba(255, 71, 87, 0.14)' }]}>
              <Ionicons name="trash-outline" size={21} color="#ff4757" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: '#ff4757' }]}>Delete Account</Text>
              <Text style={[styles.actionSub, { color: theme.colors.textSecondary }]}>
                Permanently delete only @{user?.username} with password verification
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ff4757" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Switch Between Accounts Modal */}
      <Modal visible={switchModalVisible} transparent animationType="slide" onRequestClose={() => setSwitchModalVisible(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setSwitchModalVisible(false)}>
          <View style={[styles.sheetContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Switch Account</Text>
              <TouchableOpacity onPress={() => setSwitchModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {/* Current Active Account */}
              <Text style={[styles.switcherGroupLabel, { color: theme.colors.textSecondary }]}>CURRENTLY LOGGED IN</Text>
              <View style={[styles.accountRow, { backgroundColor: 'rgba(43, 203, 186, 0.12)', borderColor: '#2bcbba' }]}>
                <View style={styles.accountRowLeft}>
                  <View style={styles.smallAvatar}>
                    {user?.avatar ? (
                      <Image source={{ uri: getMediaUrl(user.avatar) }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.smallAvatarInitial}>{(user?.fullName || user?.username || 'U').charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.accName, { color: theme.colors.text }]} numberOfLines={1}>
                      {user?.fullName || user?.username}
                    </Text>
                    <Text style={[styles.accSub, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                      @{user?.username} • {user?.email}
                    </Text>
                  </View>
                </View>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
              </View>

              {/* Other Accounts */}
              <Text style={[styles.switcherGroupLabel, { color: theme.colors.textSecondary, marginTop: 14 }]}>OTHER ACCOUNTS</Text>
              {otherAccounts.length > 0 ? (
                otherAccounts.map((acc) => (
                  <TouchableOpacity
                    key={acc._id}
                    style={[styles.accountRow, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}
                    onPress={() => handleSwitchToAccount(acc)}
                    disabled={switchingAccountId === acc._id}
                  >
                    <View style={styles.accountRowLeft}>
                      <View style={styles.smallAvatar}>
                        {acc.avatar ? (
                          <Image source={{ uri: getMediaUrl(acc.avatar) }} style={styles.avatarImg} />
                        ) : (
                          <Text style={styles.smallAvatarInitial}>
                            {(acc.fullName || acc.username || 'U').charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.accName, { color: theme.colors.text }]} numberOfLines={1}>
                          {acc.fullName || acc.username}
                        </Text>
                        <Text style={[styles.accSub, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                          @{acc.username} • {acc.email}
                        </Text>
                      </View>
                    </View>
                    {switchingAccountId === acc._id ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <Ionicons name="log-in-outline" size={22} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[styles.noOtherText, { color: theme.colors.textSecondary }]}>
                  No other accounts added yet.
                </Text>
              )}

              <TouchableOpacity
                style={[styles.addAccountSheetBtn, { borderColor: theme.colors.primary }]}
                onPress={() => {
                  setSwitchModalVisible(false);
                  navigation.navigate('AddAccountLogin', { isAddingAccount: true });
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 15, marginLeft: 8 }}>
                  Add Another Account
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Current Account Modal (Password Verified) */}
      <Modal visible={isDeleteModalVisible} transparent animationType="slide" onRequestClose={() => setIsDeleteModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.deleteOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
            <View style={[styles.deleteModalContent, { backgroundColor: theme.colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Delete Account</Text>
                <TouchableOpacity onPress={() => setIsDeleteModalVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <View style={[styles.targetAccountBanner, { backgroundColor: 'rgba(255, 71, 87, 0.1)' }]}>
                <Ionicons name="warning-outline" size={18} color="#ff4757" />
                <Text style={{ color: '#ff4757', fontSize: 12, fontWeight: '600', flex: 1, marginLeft: 8 }}>
                  This deletes ONLY your current account (@{user?.username}). Other saved accounts remain safe.
                </Text>
              </View>

              {deleteStep === 1 && (
                <View>
                  <Text style={[styles.modalInstruction, { color: theme.colors.textSecondary }]}>
                    Could you tell us your reason for deleting this account?
                  </Text>
                  <TouchableOpacity
                    style={[styles.dropdownSelector, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}
                    onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <Text style={{ color: deleteReason ? theme.colors.text : theme.colors.textSecondary, fontSize: 15 }}>
                      {deleteReason || 'Select a reason'}
                    </Text>
                    <Ionicons name={isDropdownOpen ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>

                  {isDropdownOpen && (
                    <View style={[styles.dropdownList, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                      {["I'm bored", 'I wanna create new account', "I don't like this anymore", 'Others'].map((reason, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.dropdownItem, { borderBottomColor: idx < 3 ? theme.colors.border : 'transparent' }]}
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

                  {deleteReason === 'Others' && (
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, marginTop: 12 }]}
                      placeholder="Please specify..."
                      placeholderTextColor={theme.colors.textSecondary}
                      value={otherReason}
                      onChangeText={setOtherReason}
                      multiline
                    />
                  )}

                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: '#ff6b81', marginTop: 18 }]}
                    onPress={() => {
                      if (deleteReason === 'Others' && !otherReason.trim()) {
                        Toast.show({ type: 'error', text1: 'Required', text2: 'Please specify your reason.' });
                        return;
                      }
                      if (!deleteReason) {
                        Toast.show({ type: 'error', text1: 'Required', text2: 'Please select a reason.' });
                        return;
                      }
                      setDeleteStep(2);
                    }}
                  >
                    <Text style={styles.modalButtonText}>Next</Text>
                  </TouchableOpacity>
                </View>
              )}

              {deleteStep === 2 && (
                <View>
                  <Text style={[styles.modalInstruction, { color: theme.colors.textSecondary }]}>
                    Verify your password for @{user?.username} to continue.
                  </Text>
                  <View style={[styles.passwordContainer, { backgroundColor: theme.colors.inputBackground }]}>
                    <TextInput
                      style={[styles.passwordInput, { color: theme.colors.text }]}
                      placeholder="Enter your password"
                      placeholderTextColor={theme.colors.textSecondary}
                      secureTextEntry={!showPassword}
                      value={deletePassword}
                      onChangeText={setDeletePassword}
                    />
                    <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: '#ff6b81', marginTop: 8 }]}
                    onPress={() => {
                      if (!deletePassword.trim()) {
                        Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter your password.' });
                        return;
                      }
                      setDeleteStep(3);
                    }}
                  >
                    <Text style={styles.modalButtonText}>Continue</Text>
                  </TouchableOpacity>
                </View>
              )}

              {deleteStep === 3 && (
                <View>
                  <Text style={[styles.modalInstruction, { color: theme.colors.textSecondary }]}>
                    Would you like to download a copy of your posts and photos before deleting @{user?.username}?
                  </Text>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: '#45aaf2', marginBottom: 12 }]}
                    onPress={handleDownloadData}
                    disabled={isDownloadingData}
                  >
                    {isDownloadingData ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>Download My Data</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: '#ff4757' }]}
                    onPress={handleFinalDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>Permanently Delete Account</Text>}
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  content: { padding: 18, paddingBottom: 40 },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 18,
    overflow: 'hidden',
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  sectionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  sectionSub: { fontSize: 12, marginTop: 2 },
  detailsBody: { borderTopWidth: 1, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 14 },
  avatarHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ff6b81',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarInitial: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  detailHeroName: { fontSize: 17, fontWeight: '800' },
  detailHeroUser: { fontSize: 13, fontWeight: '600', marginTop: 1 },
  editMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
  },
  editMiniText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  detailItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  detailLabel: { fontSize: 13, fontWeight: '600' },
  detailValue: { fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
  otherBody: { borderTopWidth: 1, padding: 16 },
  switchMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  switchMainBtnText: { fontSize: 15, fontWeight: '700', flex: 1, marginLeft: 10 },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  accountRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ff6b81',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  smallAvatarInitial: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  accName: { fontSize: 15, fontWeight: '700' },
  accSub: { fontSize: 12, marginTop: 1 },
  accountRowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchPillBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  switchPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  removeMiniBtn: { padding: 2 },
  noOtherText: { fontSize: 13, textAlign: 'center', paddingVertical: 8, lineHeight: 19 },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  actionTitle: { fontSize: 16, fontWeight: '700' },
  actionSub: { fontSize: 12, marginTop: 2 },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginBottom: 12,
  },
  switcherGroupLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  activeBadge: { backgroundColor: '#2bcbba', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  activeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  addAccountSheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 8,
  },
  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  deleteModalContent: { borderRadius: 20, padding: 22, marginHorizontal: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 19, fontWeight: '800' },
  targetAccountBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  modalInstruction: { fontSize: 14, marginBottom: 14, lineHeight: 20 },
  dropdownSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  dropdownList: { marginTop: 6, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  dropdownItem: { padding: 14, borderBottomWidth: 1 },
  modalInput: { borderRadius: 12, padding: 14, fontSize: 15, minHeight: 50 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, marginBottom: 14 },
  passwordInput: { flex: 1, padding: 14, fontSize: 15 },
  eyeIcon: { paddingHorizontal: 14 },
  modalButton: { padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
