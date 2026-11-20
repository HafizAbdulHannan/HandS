import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal, TextInput, Alert, Share, RefreshControl, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import axiosInstance, { getMediaUrl } from '../api/axiosConfig';
import Toast from 'react-native-toast-message';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { theme } = useThemeContext();
  const isFocused = useIsFocused();
  
  const [posts, setPosts] = useState([]);
  const [partner, setPartner] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  // Edit & Options state
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedPostOptions, setSelectedPostOptions] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (isFocused) {
      fetchMyPosts();
      fetchPartner();
    }
  }, [isFocused]);

  const fetchMyPosts = async () => {
    try {
      const response = await axiosInstance.get('/posts');
      const myPosts = response.data.filter(p => p.author?._id === user?._id);
      setPosts(myPosts);
    } catch (error) {
      console.log('Error fetching my posts:', error);
    }
  };

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

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMyPosts(), fetchPartner()]);
    setRefreshing(false);
  };

  const handleLike = async (postId, currentLikes = []) => {
    const userId = user?._id;
    const isLiked = currentLikes.includes(userId);

    setPosts(posts.map(post => {
      if (post._id === postId) {
        let newLikes = [...(post.likes || [])];
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
      fetchMyPosts();
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
              fetchMyPosts();
            }
          }
        }
      ]
    );
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Connect with me on HandS! My username is @${user?.username}`,
      });
    } catch (error) {
      console.log('Error sharing profile:', error);
    }
  };

  const totalPosts = posts.length;
  const totalLikes = posts.reduce((sum, post) => sum + (post.likes?.length || 0), 0);
  const totalComments = posts.reduce((sum, post) => sum + (post.comments?.length || 0), 0);

  const renderPostMedia = (item) => {
    if (!item.mediaUrl || item.mediaType === 'none') return null;
    const resolvedUrl = getMediaUrl(item.mediaUrl);

    if (item.mediaType === 'image' || item.mediaType === 'drawing') {
      return <Image source={{ uri: resolvedUrl }} style={styles.feedPostImage} />;
    }

    if (item.mediaType === 'video') {
      return (
        <Video
          source={{ uri: resolvedUrl }}
          style={styles.feedPostImage}
          useNativeControls
          resizeMode="contain"
        />
      );
    }

    if (item.mediaType === 'file') {
      const fileName = item.mediaUrl.split('/').pop() || 'Attached Document';
      return (
        <TouchableOpacity
          style={[styles.fileAttachmentBox, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}
          onPress={() => Linking.openURL(resolvedUrl).catch(() => {})}
        >
          <Ionicons name="document-text" size={26} color={theme.colors.primary} />
          <Text style={[styles.fileAttachmentName, { color: theme.colors.text }]} numberOfLines={1}>{fileName}</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  const renderHeader = () => (
    <View style={[styles.profileHeader, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.topUsername, { color: theme.colors.text }]}>@{user?.username || 'user'}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} style={{ padding: 4 }}>
          <Ionicons name="create-outline" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} style={styles.avatarContainer} activeOpacity={0.85}>
          {user?.avatar ? (
            <Image source={{ uri: getMediaUrl(user.avatar) }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{user?.username ? user.username.charAt(0).toUpperCase() : 'U'}</Text>
          )}
        </TouchableOpacity>
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>{totalPosts}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Posts</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>{totalLikes}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Likes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>{totalComments}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Comments</Text>
          </View>
        </View>
      </View>

      <View style={styles.bioSection}>
        <Text style={[styles.name, { color: theme.colors.text }]}>{user?.fullName || user?.username || 'User'}</Text>
        {user?.email ? (
          <Text style={[styles.emailText, { color: theme.colors.textSecondary }]}>{user.email}</Text>
        ) : null}
        {user?.bio ? (
          <Text style={[styles.bioText, { color: theme.colors.text }]}>{user.bio}</Text>
        ) : null}
        {partner ? (
          <TouchableOpacity
            style={styles.partnerBadge}
            onPress={() => navigation.navigate('PartnerProfile')}
            activeOpacity={0.8}
          >
            <Ionicons name="heart" size={14} color="#ff6b81" />
            <Text style={styles.partnerBadgeText}>Paired with @{partner.username}</Text>
            <Ionicons name="chevron-forward" size={14} color="#ff6b81" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.partnerBadge, { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground }]}
            onPress={() => navigation.navigate('Pairing')}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add-outline" size={14} color={theme.colors.primary} />
            <Text style={[styles.partnerBadgeText, { color: theme.colors.textSecondary }]}>No partner connected • Tap to link</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]} onPress={() => navigation.navigate('EditProfile')}>
          <Ionicons name="pencil-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={[styles.actionBtnText, { color: '#fff' }]}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border, borderWidth: 1 }]} onPress={handleShareProfile}>
          <Ionicons name="share-social-outline" size={16} color={theme.colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Share Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPost = ({ item }) => {
    return (
      <View style={[styles.postCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.postHeader}>
          <View style={[styles.avatarPlaceholder, { overflow: 'hidden' }]}>
            {item.author?.avatar ? (
              <Image source={{ uri: getMediaUrl(item.author.avatar) }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
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
              style={[styles.editPostInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
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
        
        {renderPostMedia(item)}
        
        <View style={[styles.postFooter, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item._id, item.likes)}>
            <Ionicons name={item.likes?.includes(user?._id) ? "heart" : "heart-outline"} size={24} color={item.likes?.includes(user?._id) ? "#ff6b81" : theme.colors.textSecondary} />
            <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>{item.likes?.length || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => { setActiveCommentPostId(activeCommentPostId === item._id ? null : item._id); setCommentText(''); }}>
            <Ionicons name="chatbubble-outline" size={22} color={theme.colors.textSecondary} />
            <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>{item.comments?.length || 0}</Text>
          </TouchableOpacity>
        </View>

        {activeCommentPostId === item._id && (
          <View style={[styles.commentSection, { borderTopColor: theme.colors.border }]}>
            {item.comments?.map((comment, index) => (
              <View key={index} style={[styles.commentItem, { backgroundColor: theme.colors.inputBackground }]}>
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
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={60} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No posts yet</Text>
          </View>
        }
      />

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
  },
  listContent: {
    paddingBottom: 40,
  },
  profileHeader: {
    borderBottomWidth: 1,
    paddingBottom: 18,
    marginBottom: 12,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  topUsername: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  avatarContainer: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#ff6b81',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 26,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ff6b81',
  },
  avatarText: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  bioSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  name: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  emailText: {
    fontSize: 13,
    marginBottom: 6,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  partnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 107, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 129, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  partnerBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff6b81',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  postCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  postHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  deletePostBtn: {
    padding: 5,
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
    marginBottom: 2,
  },
  postTime: { 
    fontSize: 13, 
  },
  postText: { 
    fontSize: 16, 
    lineHeight: 24,
    marginBottom: 12
  },
  feedPostImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#000',
  },
  fileAttachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 10,
  },
  fileAttachmentName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  actionText: {
    marginLeft: 6,
    fontSize: 15,
    fontWeight: '600',
  },
  commentSection: {
    marginTop: 12,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  commentItem: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  commentAuthor: {
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  commentInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 14,
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
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '600',
  }
});
