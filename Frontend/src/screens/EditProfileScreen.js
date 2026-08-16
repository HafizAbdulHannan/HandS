import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import axiosInstance, { STATIC_URL } from '../api/axiosConfig';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';

export default function EditProfileScreen() {
  const { user, loadUser } = useAuth();
  const { theme } = useThemeContext();
  const navigation = useNavigation();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUri, setAvatarUri] = useState(user?.avatar ? `${STATIC_URL}${user.avatar}` : null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setAvatarUri(asset.uri);
      setSelectedImage({
        uri: asset.uri,
        name: asset.fileName || asset.uri.split('/').pop(),
        type: asset.mimeType || 'image/jpeg'
      });
    }
  };

  const handleRemoveImage = () => {
    setAvatarUri(null);
    setSelectedImage({ remove: true });
  };

  const handleSave = async () => {
    if (!fullName.trim() || !username.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Name and Username are required' });
      return;
    }

    setIsSaving(true);
    try {
      let finalAvatarPath = user?.avatar;

      if (selectedImage) {
        if (selectedImage.remove) {
          finalAvatarPath = '';
        } else {
          const formData = new FormData();
          formData.append('media', {
            uri: selectedImage.uri,
            name: selectedImage.name,
            type: selectedImage.type,
          });

          const uploadRes = await axiosInstance.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          finalAvatarPath = uploadRes.data;
        }
      }

      await axiosInstance.put('/auth/profile', {
        fullName,
        username,
        bio,
        avatar: finalAvatarPath
      });

      await loadUser(); // Reload user context to update whole app
      Toast.show({ type: 'success', text1: 'Success', text2: 'Profile updated successfully!' });
      navigation.goBack();
    } catch (error) {
      console.log('Error updating profile:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={[styles.cancelText, { color: theme.colors.text }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Edit profile</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator size="small" color="#ff6b81" />
          ) : (
            <Text style={styles.doneText}>Done</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handlePickImage} style={styles.avatarWrapper}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={50} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            
            <View style={styles.avatarActions}>
              <TouchableOpacity onPress={handlePickImage}>
                <Text style={styles.changePhotoText}>Edit picture</Text>
              </TouchableOpacity>
              {avatarUri && (
                <TouchableOpacity onPress={handleRemoveImage} style={styles.removePhotoBtn}>
                  <Text style={styles.removePhotoText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Name</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, borderBottomColor: theme.colors.border }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Name"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Username</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, borderBottomColor: theme.colors.border }]}
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                autoCapitalize="none"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Bio</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, borderBottomColor: theme.colors.border }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Bio"
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                maxLength={150}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 8,
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelText: {
    fontSize: 16,
  },
  doneText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff6b81',
    textAlign: 'right',
  },
  scrollContent: {
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: '#ddd',
    marginBottom: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#ff6b81',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  changePhotoText: {
    color: '#3498db',
    fontWeight: '600',
    fontSize: 15,
  },
  removePhotoBtn: {
    borderLeftWidth: 1,
    borderLeftColor: '#ddd',
    paddingLeft: 16,
  },
  removePhotoText: {
    color: '#e74c3c',
    fontWeight: '600',
    fontSize: 15,
  },
  formSection: {
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    fontSize: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  }
});
