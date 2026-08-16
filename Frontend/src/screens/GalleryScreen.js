import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Dimensions, RefreshControl, TouchableOpacity, ActivityIndicator, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import axiosInstance, { STATIC_URL } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Toast from 'react-native-toast-message';
import Constants from 'expo-constants';

// We need the base URL to prepend to the uploaded image path if the backend only returns '/uploads/...'
// Since axiosInstance has baseURL, we can extract it.
const baseURL = axiosInstance.defaults.baseURL.replace('/api', '');

const { width } = Dimensions.get('window');
const columnWidth = (width - 60) / 2; 

export default function GalleryScreen() {
  const { user } = useAuth();
  const { sendNotification } = useSocket();
  const [images, setImages] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!selectedImage) return;
    
    try {
      setIsDownloading(true);
      
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need media library permissions to download images.');
        setIsDownloading(false);
        return;
      }
      
      let fileUrl = selectedImage.mediaUrl;
      if (!fileUrl.startsWith('http')) {
        fileUrl = `${STATIC_URL}${fileUrl}`;
      }
      // create a filename
      const filename = fileUrl.split('/').pop() || 'downloaded_image.jpg';
      const fileUri = FileSystem.documentDirectory + filename;
      
      const downloadRes = await FileSystem.downloadAsync(fileUrl, fileUri);
      
      if (downloadRes.status === 200) {
        await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
        Toast.show({ type: 'success', text1: 'Saved!', text2: 'Image saved to your gallery.' });
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to download image.' });
      }
    } catch (error) {
      console.log('Download error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not save the image.' });
    } finally {
      setIsDownloading(false);
    }
  };

  const fetchGallery = async () => {
    try {
      const response = await axiosInstance.get('/posts/gallery');
      setImages(response.data);
    } catch (error) {
      console.log('Error fetching gallery:', error);
    }
  };

  useEffect(() => {
    fetchGallery();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGallery();
    setRefreshing(false);
  };

  const handlePickAndUpload = async () => {
    // Request permission
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: "You've refused to allow this app to access your photos!" });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // Can also support Videos later
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      uploadImage(result.assets[0]);
    }
  };

  const uploadImage = async (asset) => {
    setIsUploading(true);
    try {
      // 1. Upload file to backend via multipart/form-data
      const localUri = asset.uri;
      const filename = localUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;

      const formData = new FormData();
      formData.append('media', {
        uri: localUri,
        name: filename,
        type,
      });

      // Send to /upload endpoint
      const uploadResponse = await axiosInstance.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const uploadedImagePath = uploadResponse.data; // e.g. "/uploads/media-12345.jpg"
      const fullImageUrl = `${baseURL}${uploadedImagePath}`;

      // 2. Create the Post in the DB with the uploaded URL
      await axiosInstance.post('/posts', { 
        content: '',
        mediaUrl: fullImageUrl,
        mediaType: 'image' 
      });
      
      // Notify partner
      sendNotification('New Photo Uploaded! 📸', `${user?.username || 'Your partner'} uploaded a photo to the gallery.`);
      
      fetchGallery(); 
      Toast.show({ type: 'success', text1: 'Uploaded!', text2: 'Image uploaded successfully.' });
    } catch (error) {
      console.log('Error uploading image:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to upload image' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Gallery</Text>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>No memories yet</Text>
            <Text style={styles.emptySubText}>Upload your first picture!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.imageContainer}
            activeOpacity={0.8}
            onPress={() => setSelectedImage(item)}
          >
            <Image source={{ uri: item.mediaUrl?.startsWith('http') ? item.mediaUrl : `${STATIC_URL}${item.mediaUrl}` }} style={styles.image} />
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
          
          {selectedImage && (
            <Image 
              source={{ uri: selectedImage.mediaUrl?.startsWith('http') ? selectedImage.mediaUrl : `${STATIC_URL}${selectedImage.mediaUrl}` }} 
              style={styles.fullScreenImage} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1a1a1a',
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
    backgroundColor: '#fff0f3',
    padding: 12,
    marginHorizontal: 24,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 129, 0.2)',
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
    backgroundColor: '#f8f9fa', 
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
    color: '#1a1a1a',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 15,
    color: '#888',
    marginTop: 8,
  },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
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
});
