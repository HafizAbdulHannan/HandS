import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Dimensions, RefreshControl, TouchableOpacity, ActivityIndicator, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import axiosInstance, { getMediaUrl } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useThemeContext } from '../context/ThemeContext';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');
const columnWidth = (width - 60) / 2;

export default function GalleryScreen() {
  const { user } = useAuth();
  const { sendNotification } = useSocket();
  const { theme } = useThemeContext();
  const [images, setImages] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [selectedImage, setSelectedImage] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!selectedImage || !selectedImage.mediaUrl) return;

    try {
      setIsDownloading(true);

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need media library permissions to save images to your device.');
        setIsDownloading(false);
        return;
      }

      const rawUrl = selectedImage.mediaUrl;
      const isVideoItem = selectedImage.mediaType === 'video';
      const fileUri = `${FileSystem.documentDirectory}HandS_${isVideoItem ? 'Video' : 'Photo'}_${Date.now()}.${isVideoItem ? 'mp4' : 'jpg'}`;

      if (rawUrl.startsWith('data:')) {
        const base64Data = rawUrl.split(',')[1];
        if (!base64Data) throw new Error('Invalid image data');
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await MediaLibrary.saveToLibraryAsync(fileUri);
        Toast.show({ type: 'success', text1: 'Saved!', text2: 'Image saved to your gallery.' });
      } else {
        const fileUrl = getMediaUrl(rawUrl);
        const downloadRes = await FileSystem.downloadAsync(fileUrl, fileUri);
        if (downloadRes.status === 200) {
          await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
          Toast.show({ type: 'success', text1: 'Saved!', text2: 'Image saved to your gallery.' });
        } else {
          Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to download image.' });
        }
      }
    } catch (error) {
      console.log('Download error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not save the image.' });
    } finally {
      setIsDownloading(false);
    }
  };

  const fetchGallery = async (pageNum = 1, shouldAppend = false) => {
    try {
      const limit = 15;
      const response = await axiosInstance.get(`/posts/gallery?page=${pageNum}&limit=${limit}`);
      const newImages = response.data;

      if (shouldAppend) {
        setImages(prev => [...prev, ...newImages]);
      } else {
        setImages(newImages);
      }

      setHasMore(newImages.length >= limit);
    } catch (error) {
      console.log('Error fetching gallery:', error);
    }
  };

  const loadMore = async () => {
    if (!hasMore || isLoadingMore || refreshing) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    await fetchGallery(nextPage, true);
    setPage(nextPage);
    setIsLoadingMore(false);
  };

  useEffect(() => {
    fetchGallery();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await fetchGallery(1, false);
    setRefreshing(false);
  };

  const handlePickAndUpload = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: "You've refused to allow this app to access your photos!" });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      uploadImage(result.assets[0]);
    }
  };

  const uploadImage = async (asset) => {
    setIsUploading(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 600, height: 600 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const base64Image = `data:image/jpeg;base64,${manipulated.base64}`;

      await axiosInstance.post('/posts', {
        content: '',
        mediaUrl: base64Image,
        mediaType: 'image'
      });

      sendNotification('New Photo Uploaded! 📸', `${user?.username || 'Your partner'} uploaded a photo to the gallery.`);
      setPage(1);
      await fetchGallery(1, false);
      Toast.show({ type: 'success', text1: 'Uploaded!', text2: 'Image uploaded successfully.' });
    } catch (error) {
      console.log('Error uploading image:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to upload image' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = () => {
    if (!selectedImage) return;

    Alert.alert(
      "Delete Photo",
      "Are you sure you want to delete this photo from the gallery?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await axiosInstance.delete(`/posts/${selectedImage._id}`);
              Toast.show({ type: 'success', text1: 'Deleted', text2: 'Photo deleted successfully.' });
              setSelectedImage(null);
              setPage(1);
              fetchGallery(1, false);
            } catch (error) {
              console.log('Error deleting image:', error);
              Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete photo' });
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Gallery</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handlePickAndUpload}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 4 }} />
          ) : (
            <Ionicons name="add" size={24} color="#ffffff" />
          )}
          <Text style={styles.uploadButtonText}>{isUploading ? "Uploading..." : "Upload"}</Text>
        </TouchableOpacity>
      </View>

      {!user?.partner && (
        <View style={styles.noPartnerBanner}>
          <Ionicons name="information-circle" size={24} color="#ff6b81" />
          <Text style={styles.noPartnerText}>Partner not linked yet. Uploading to your private space.</Text>
        </View>
      )}

      <FlatList
        data={images}
        keyExtractor={(item) => item._id}
        numColumns={2}
        contentContainerStyle={styles.galleryContainer}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.columnWrapper}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isLoadingMore ? <ActivityIndicator size="large" color="#ff6b81" style={{ marginVertical: 20 }} /> : null}
        ListEmptyComponent={
          !refreshing && (
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={60} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.text }]}>No memories yet</Text>
              <Text style={[styles.emptySubText, { color: theme.colors.textSecondary }]}>Upload your first picture!</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.imageContainer, { backgroundColor: theme.colors.card }]}
            activeOpacity={0.8}
            onPress={() => setSelectedImage(item)}
          >
            {item.mediaType === 'video' ? (
              <View style={[styles.image, { backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="play-circle" size={48} color="#ff6b81" />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 6 }}>Video</Text>
              </View>
            ) : (
              <Image source={{ uri: getMediaUrl(item.mediaUrl) }} style={styles.image} />
            )}
            <View style={styles.uploaderTag}>
              <Text style={styles.uploaderText}>
                {item.author?._id === user?._id ? 'You' : item.author?.username}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Image Viewer Modal */}
      <Modal
        visible={!!selectedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.fullScreenOverlay}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.downloadButton}
            onPress={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="download-outline" size={28} color="#fff" />
            )}
          </TouchableOpacity>

          {selectedImage?.author?._id === user?._id && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={28} color="#fff" />
            </TouchableOpacity>
          )}

          {selectedImage && (
            selectedImage.mediaType === 'video' ? (
          <Video
            source={{ uri: getMediaUrl(selectedImage.mediaUrl) }}
            style={styles.fullScreenImage}
            useNativeControls
            resizeMode="contain"
            shouldPlay
          />
          ) : (
          <Image
            source={{ uri: getMediaUrl(selectedImage.mediaUrl) }}
            style={styles.fullScreenImage}
            resizeMode="contain"
          />
          )
          )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6b81',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#ff6b81',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 4,
  },
  noPartnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 129, 0.12)',
    padding: 12,
    marginHorizontal: 24,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 129, 0.25)',
  },
  noPartnerText: {
    marginLeft: 10,
    color: '#ff6b81',
    fontWeight: '600',
    fontSize: 13,
    flex: 1,
  },
  galleryContainer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
    flexGrow: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  imageContainer: {
    width: columnWidth,
    height: columnWidth * 1.2,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploaderTag: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  uploaderText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 15,
    marginTop: 8,
  },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  downloadButton: {
    position: 'absolute',
    bottom: 50,
    right: 30,
    zIndex: 10,
    backgroundColor: '#ff6b81',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  deleteButton: {
    position: 'absolute',
    bottom: 50,
    left: 30,
    zIndex: 10,
    backgroundColor: '#ff4757',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
});
