import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, RefreshControl, TextInput, ActivityIndicator, Platform, Alert, Modal } from 'react-native';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import axiosInstance, { STATIC_URL, getMediaUrl } from '../api/axiosConfig';
import FloatingEmojis from '../components/FloatingEmojis';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';

export default function HomeScreen({ route }) {
  const { sendMissYou, sendLoveYou, sendNotification, animationType } = useSocket();
  const { user } = useAuth();
  const { theme } = useThemeContext();
  const navigation = useNavigation();
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  
  const [selectedMediaType, setSelectedMediaType] = useState('none');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [partner, setPartner] = useState(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  // Edit & Options state
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedPostOptions, setSelectedPostOptions] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);

  const flatListRef = React.useRef(null);

  useEffect(() => {
    if (route?.params?.highlightPostId && posts.length > 0) {
      const index = filteredPosts.findIndex(p => p._id === route.params.highlightPostId);
      if (index !== -1) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
        }, 500);
      }
    }
  }, [route?.params?.highlightPostId, posts]);

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

  useEffect(() => {
    fetchPartner();
  }, [user?.partner]);

  const fetchPosts = async () => {
    try {
      const response = await axiosInstance.get('/posts');
      setPosts(response.data);
    } catch (error) {
      console.log('Error fetching posts:', error);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    if (user?.partner) {
      await fetchPartner();
    }
    setRefreshing(false);
  };

  const handleLike = async (postId, currentLikes) => {
    const userId = user._id;
    const isLiked = currentLikes.includes(userId);
    
    setPosts(posts.map(post => {
      if (post._id === postId) {
        let newLikes = [...post.likes];
        if (isLiked) {
          newLikes = newLikes.filter(id => id !== userId);
        } else {
          newLikes.push(userId);
        }
        return { ...post, likes: newLikes };
      }
      return post;
    }));

    try {
      await axiosInstance.put(`/posts/${postId}/like`);
    } catch (error) {
      console.log('Error toggling like:', error);
      fetchPosts();
    }
  };

  const handleAddComment = async (postId) => {
    if (!commentText.trim()) return;
    setIsCommenting(true);
    try {
      const response = await axiosInstance.post(`/posts/${postId}/comment`, {
        text: commentText
      });
      setPosts(posts.map(post => {
        if (post._id === postId) {
          return { ...post, comments: response.data };
        }
        return post;
      }));
      setCommentText('');
      Toast.show({ type: 'success', text1: 'Comment Added', text2: 'Your comment was added successfully.' });
    } catch (error) {
      console.log('Error adding comment:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to add comment' });
    } finally {
      setIsCommenting(false);
    }
  };

  const openPostOptions = (post) => {
    setSelectedPostOptions(post);
    setOptionsModalVisible(true);
  };

  const handleEditInit = () => {
    setOptionsModalVisible(false);
    if (!selectedPostOptions) return;
    setEditingPostId(selectedPostOptions._id);
    setEditContent(selectedPostOptions.content || '');
  };

  const handleEditSubmit = async () => {
    if (!editContent.trim()) {
      setEditingPostId(null);
      return;
    }
    try {
      const response = await axiosInstance.put(`/posts/${editingPostId}`, { content: editContent });
      setPosts(posts.map(p => p._id === editingPostId ? response.data : p));
      setEditingPostId(null);
      Toast.show({ type: 'success', text1: 'Updated', text2: 'Post updated successfully.' });
    } catch (error) {
      console.log('Error updating post:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to update post' });
    }
  };

  const handleDeleteTrigger = () => {
    setOptionsModalVisible(false);
    if (!selectedPostOptions) return;
    const postId = selectedPostOptions._id;
    
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            setPosts(posts.filter(p => p._id !== postId));
            try {
              await axiosInstance.delete(`/posts/${postId}`);
              Toast.show({ type: 'success', text1: 'Deleted', text2: 'Post deleted successfully.' });
            } catch (error) {
              console.log('Error deleting post:', error);
              Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete post' });
              fetchPosts();
            }
          }
        }
      ]
    );
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedMedia({
        uri: asset.uri,
        name: asset.fileName || asset.uri.split('/').pop(),
        mimeType: asset.mimeType || 'image/jpeg',
        type: 'image'
      });
      setSelectedMediaType('image');
    }
  };

  const pickVideo = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedMedia({
        uri: asset.uri,
        name: asset.fileName || asset.uri.split('/').pop(),
        mimeType: asset.mimeType || 'video/mp4',
        type: 'video'
      });
      setSelectedMediaType('video');
    }
  };

  const pickDocument = async () => {
    let result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedMedia({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || 'application/octet-stream',
        type: 'file'
      });
      setSelectedMediaType('file');
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !selectedMedia) return;
    setIsPosting(true);
    
    let mediaUrl = '';
    
    try {
      if (selectedMedia) {
        const formData = new FormData();
        formData.append('media', {
          uri: selectedMedia.uri,
          name: selectedMedia.name,
          type: selectedMedia.mimeType,
        });
        
        const uploadResponse = await axiosInstance.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        mediaUrl = uploadResponse.data;
      }

      await axiosInstance.post('/posts', { 
        content: newPostContent,
        mediaUrl: mediaUrl,
        mediaType: selectedMedia ? selectedMedia.type : 'none'
      });
      
      // Notify partner
      sendNotification('New Memory Added! 💖', `${user?.username || 'Your partner'} just posted a new memory.`);
      
      setNewPostContent('');
      setSelectedMedia(null);
      setSelectedMediaType('none');
      fetchPosts();
      Toast.show({ type: 'success', text1: 'Posted!', text2: 'Your memory has been shared.' });
    } catch (error) {
      console.log('Error creating post:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to create post' });
    } finally {
      setIsPosting(false);
    }
  };

  const isToday = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.content?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          post.author?.username?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && isToday(post.createdAt);
  });

  const headerComponent = (
    <View style={styles.listHeader}>
      {!user?.partner && (
        <View style={styles.noPartnerBanner}>
          <Ionicons name="information-circle" size={24} color="#ff6b81" />
          <Text style={styles.noPartnerText}>Connect with partner to see their feed.</Text>
        </View>
      )}
      
      <View style={[styles.postCreatorBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.text }]}>
        <View style={styles.postCreatorHeader}>
          <View style={[styles.currentUserAvatar, { overflow: 'hidden' }]}>
            {user?.avatar ? (
              <Image source={{ uri: getMediaUrl(user.avatar) }} style={styles.headerProfileImage} />
            ) : (
              <Text style={styles.currentUserInitial}>{user?.username?.charAt(0).toUpperCase() || 'U'}</Text>
            )}
          </View>
          <TextInput
            style={[styles.postInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
            placeholder="Share a memory, video, or document..."
            placeholderTextColor={theme.colors.textSecondary}
            value={newPostContent}
            onChangeText={setNewPostContent}
            multiline
          />
        </View>
        
        {selectedMedia && (
          <View style={styles.previewContainer}>
            {selectedMedia.type === 'image' ? (
              <Image source={{ uri: selectedMedia.uri }} style={styles.previewImage} />
            ) : (
              <View style={styles.previewIconBox}>
                <Ionicons name={selectedMedia.type === 'video' ? 'videocam' : 'document'} size={32} color="#ff6b81" />
                <Text style={styles.previewText} numberOfLines={1}>{selectedMedia.name}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.cancelPreviewBtn} onPress={() => { setSelectedMedia(null); setSelectedMediaType('none'); }}>
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.postActionsRow}>
          <TouchableOpacity style={styles.postActionBtn} onPress={pickImage}>
            <Ionicons name="image-outline" size={22} color={theme.colors.primary} />
            <Text style={[styles.postActionText, { color: theme.colors.textSecondary }]}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postActionBtn} onPress={pickVideo}>
            <Ionicons name="videocam-outline" size={22} color="#45aaf2" />
            <Text style={[styles.postActionText, { color: theme.colors.textSecondary }]}>Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postActionBtn} onPress={pickDocument}>
            <Ionicons name="document-text-outline" size={22} color="#2bcbba" />
            <Text style={[styles.postActionText, { color: theme.colors.textSecondary }]}>Document</Text>
          </TouchableOpacity>
        </View>
        
        {(newPostContent || selectedMedia) && (
          <TouchableOpacity style={styles.submitPostBtn} onPress={handleCreatePost} disabled={isPosting}>
            {isPosting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitPostText}>Post</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {animationType === 'miss_you' && <FloatingEmojis emoji="🥺" text="Miss You" />}
      {animationType === 'love_you' && <FloatingEmojis emoji="😘" text="Love You" />}

      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <View style={styles.headerTitle}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Our Space</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={[styles.headerProfileIcon, { overflow: 'hidden' }]} onPress={() => navigation.navigate('Profile')}>
            {user?.avatar ? (
              <Image source={{ uri: getMediaUrl(user.avatar) }} style={styles.headerProfileImage} />
            ) : (
              <Text style={styles.headerProfileLetter}>{user?.username?.charAt(0).toUpperCase() || 'U'}</Text>
            )}
          </TouchableOpacity>
          {partner && (
            <>
              <View style={styles.heartIconContainer}>
                <Ionicons name="heart" size={22} color="#ff6b81" />
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('PartnerProfile')} style={[styles.headerProfileIcon, { backgroundColor: '#ff9ff3', overflow: 'hidden' }]}>
                {partner.avatar ? (
                  <Image source={{ uri: getMediaUrl(partner.avatar) }} style={styles.headerProfileImage} />
                ) : (
                  <Text style={styles.headerProfileLetter}>{partner.username?.charAt(0).toUpperCase() || 'P'}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainerWrapper}>
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput 
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search posts..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity 
          style={styles.connectPartnerBtn}
          onPress={() => navigation.navigate('Pairing')}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.connectPartnerText}>Partner</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={filteredPosts}
        onScrollToIndexFailed={info => {
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          });
        }}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.feed}
        showsVerticalScrollIndicator={false}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={11}
        removeClippedSubviews={true}
        ListHeaderComponent={headerComponent}
        ListEmptyComponent={
          !refreshing && (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No Posts Uploaded Today.</Text>
            </View>
          )
        }
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item, index }) => (
          <Animated.View 
            entering={FadeInUp.delay(index * 100)} 
            layout={Layout.springify()}
            style={[
              styles.postCard, 
              { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border },
              route?.params?.highlightPostId === item._id && { borderColor: '#ff6b81', borderWidth: 2 }
            ]}
          >
            <View style={styles.postHeader}>
              <View style={[styles.avatarPlaceholder, { overflow: 'hidden' }]}>
                {item.author?.avatar ? (
                  <Image source={{ uri: getMediaUrl(item.author.avatar) }} style={styles.headerProfileImage} />
                ) : (
                  <Text style={styles.avatarLetter}>{item.author?.username?.charAt(0).toUpperCase() || 'U'}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.postAuthor, { color: theme.colors.text }]}>{item.author?.username || 'User'}</Text>
                <Text style={[styles.postTime, { color: theme.colors.textSecondary }]}>{new Date(item.createdAt).toLocaleString()}</Text>
              </View>
              {item.author?._id === user?._id && (
                <TouchableOpacity onPress={() => openPostOptions(item)} style={styles.deletePostBtn}>
                  <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            
            {editingPostId === item._id ? (
              <View style={styles.editPostContainer}>
                <TextInput
                  style={[styles.editPostInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                  value={editContent}
                  onChangeText={setEditContent}
                  multiline
                />
                <View style={styles.editPostActions}>
                  <TouchableOpacity onPress={() => setEditingPostId(null)} style={styles.editCancelBtn}>
                    <Text style={styles.editCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleEditSubmit} style={styles.editSaveBtn}>
                    <Text style={styles.editSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              item.content ? <Text style={[styles.postText, { color: theme.colors.text }]}>{item.content}</Text> : null
            )}
            
            {item.mediaUrl && item.mediaType === 'image' && (
              <Image source={{ uri: `${STATIC_URL}${item.mediaUrl}` }} style={styles.postImage} />
            )}
            
            <View style={styles.postFooter}>
              <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item._id, item.likes)}>
                <Ionicons name={item.likes?.includes(user._id) ? "heart" : "heart-outline"} size={24} color={item.likes?.includes(user._id) ? "#ff6b81" : theme.colors.textSecondary} />
                <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>{item.likes?.length || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => { setActiveCommentPostId(activeCommentPostId === item._id ? null : item._id); setCommentText(''); }}>
                <Ionicons name="chatbubble-outline" size={22} color={theme.colors.textSecondary} />
                <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>{item.comments?.length || 0}</Text>
              </TouchableOpacity>
            </View>

            {activeCommentPostId === item._id && (
              <View style={styles.commentSection}>
                {item.comments?.map((comment, index) => (
                  <View key={index} style={styles.commentItem}>
                    <Text style={[styles.commentAuthor, { color: theme.colors.text }]}>{comment.user?.username || 'User'}</Text>
                    <Text style={[styles.commentText, { color: theme.colors.textSecondary }]}>{comment.text}</Text>
                  </View>
                ))}
                
                <View style={styles.commentInputContainer}>
                  <TextInput 
                    style={[styles.commentInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                    placeholder="Write a comment..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                  />
                  <TouchableOpacity 
                    style={styles.sendCommentBtn}
                    onPress={() => handleAddComment(item._id)}
                    disabled={isCommenting || !commentText.trim()}
                  >
                    {isCommenting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="send" size={16} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        )}
      />

      <View style={styles.fabContainer}>
        {isFabMenuOpen && (
          <View style={styles.miniFabMenu}>
            <TouchableOpacity 
              style={styles.miniFab} 
              activeOpacity={0.8} 
              onPress={() => { setIsFabMenuOpen(false); sendLoveYou(); }}
            >
              <Text style={styles.miniFabIcon}>😘</Text>
              <Text style={styles.miniFabText}>Love You</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.miniFab} 
              activeOpacity={0.8} 
              onPress={() => { setIsFabMenuOpen(false); sendMissYou(); }}
            >
              <Text style={styles.miniFabIcon}>🥺</Text>
              <Text style={styles.miniFabText}>Miss You</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={styles.mainFab} activeOpacity={0.8} onPress={() => setIsFabMenuOpen(!isFabMenuOpen)}>
          <Text style={styles.mainFabIcon}>❤️</Text>
        </TouchableOpacity>
      </View>

      {/* Post Options Modal */}
      <Modal
        visible={optionsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setOptionsModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalDragIndicator} />
            <TouchableOpacity style={styles.modalOptionBtn} onPress={handleEditInit}>
              <Ionicons name="pencil-outline" size={22} color={theme.colors.text} />
              <Text style={[styles.modalOptionText, { color: theme.colors.text }]}>Edit Post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOptionBtn} onPress={handleDeleteTrigger}>
              <Ionicons name="trash-outline" size={22} color="#ff6b81" />
              <Text style={[styles.modalOptionText, { color: '#ff6b81' }]}>Delete Post</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fcfcfc', 
  },
  heartsOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  lottieHearts: { width: 300, height: 300 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#fcfcfc',
  },
  title: { 
    fontSize: 34, 
    fontWeight: '800', 
    color: '#1a1a1a',
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heartIconContainer: {
    marginHorizontal: 8,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerProfileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ff6b81',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff6b81',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  headerProfileLetter: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 20,
  },
  headerProfileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalDragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#e1e1e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  modalOptionText: {
    fontSize: 16,
    marginLeft: 16,
    fontWeight: '600',
  },
  editPostContainer: {
    marginTop: 10,
    marginBottom: 10,
  },
  editPostInput: {
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  editPostActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  editCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    justifyContent: 'center',
  },
  editCancelText: {
    color: '#888',
    fontWeight: '600',
  },
  editSaveBtn: {
    backgroundColor: '#ff6b81',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
  },
  editSaveText: {
    color: '#fff',
    fontWeight: '600',
  },
  searchContainerWrapper: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 15,
    alignItems: 'center',
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  connectPartnerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6b81',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#ff6b81',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  connectPartnerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  feed: { 
    paddingHorizontal: 20,
    paddingBottom: 40, 
  },
  listHeader: {
    marginBottom: 16,
  },
  noPartnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff0f3',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 129, 0.2)',
  },
  noPartnerText: {
    marginLeft: 10,
    color: '#ff6b81',
    fontWeight: '600',
    fontSize: 15,
    flex: 1,
  },
  postCreatorBox: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    marginHorizontal: 4,
    marginBottom: 20,
    marginTop: 5,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 6,
  },
  postCreatorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  currentUserAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  currentUserInitial: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 20,
  },
  postInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: 'top',
    borderRadius: 16,
    padding: 12,
    paddingTop: 12,
  },
  previewContainer: {
    marginVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#f8f9fa',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewIconBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  previewText: {
    marginTop: 8,
    color: '#555',
    fontSize: 12,
    fontWeight: '500',
    maxWidth: '90%',
    textAlign: 'center',
  },
  cancelPreviewBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 15,
    marginTop: 10,
  },
  postActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
  },
  postActionText: {
    marginLeft: 6,
    fontSize: 15,
    fontWeight: '600',
  },
  submitPostBtn: {
    backgroundColor: '#ff6b81',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 15,
  },
  submitPostText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  postActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f1f1',
    paddingTop: 12,
  },
  mediaIcons: {
    flexDirection: 'row',
  },
  mediaIconButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 20,
  },
  mediaIconSelected: {
    backgroundColor: '#fff0f3',
  },
  postButton: {
    backgroundColor: '#ff6b81',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  postButtonDisabled: {
    backgroundColor: '#ffb5c1',
  },
  postButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  postHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  avatarPlaceholder: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 14,
    backgroundColor: '#ff6b81'
  },
  avatarLetter: { 
    color: '#ffffff', 
    fontWeight: 'bold', 
    fontSize: 20 
  },
  postAuthor: { 
    fontWeight: 'bold', 
    fontSize: 17, 
    color: '#1a1a1a',
    marginBottom: 2,
  },
  postTime: { 
    fontSize: 13, 
    color: '#888' 
  },
  deletePostBtn: {
    padding: 8,
  },
  postText: { 
    fontSize: 16, 
    color: '#444', 
    lineHeight: 24,
    marginBottom: 12
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12
  },
  mediaPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  mediaPlaceholderText: {
    marginTop: 8,
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  attachmentName: {
    marginTop: 4,
    color: '#555',
    fontSize: 12,
    maxWidth: '80%',
    textAlign: 'center',
  },
  postFooter: {
    flexDirection: 'row',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
    paddingTop: 12
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20
  },
  actionText: {
    marginLeft: 6,
    color: '#555',
    fontSize: 14,
    fontWeight: '600'
  },
  commentSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f1f1',
    paddingTop: 12,
  },
  commentItem: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  commentAuthor: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#1a1a1a',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: '#444',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f1f3f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 14,
    color: '#333',
  },
  sendCommentBtn: {
    backgroundColor: '#ff6b81',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    alignItems: 'flex-end',
  },
  miniFabMenu: {
    marginBottom: 15,
    alignItems: 'flex-end',
  },
  miniFab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  miniFabIcon: {
    fontSize: 20,
    marginRight: 8,
    includeFontPadding: false,
    textAlignVertical: 'center',
    padding: 2,
  },
  miniFabText: {
    color: '#ff6b81',
    fontWeight: 'bold',
    fontSize: 14,
  },
  mainFab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ff6b81',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff6b81',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  mainFabIcon: {
    fontSize: 28,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  }
});
