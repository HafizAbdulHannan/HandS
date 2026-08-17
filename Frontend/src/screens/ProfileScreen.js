import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Dimensions, Modal, TextInput, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import axiosInstance, { STATIC_URL, getMediaUrl } from '../api/axiosConfig';
import Toast from 'react-native-toast-message';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, logout, loadUser } = useAuth();
  const { isDarkMode, toggleTheme, theme } = useThemeContext();
  const isFocused = useIsFocused();
  
  const [posts, setPosts] = useState([]);
  const [partner, setPartner] = useState(null);

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
        message: `Check out my profile on HandS! My username is ${user?.username}`,
      });
    } catch (error) {
      console.log('Error sharing profile:', error);
    }
  };

  const totalPosts = posts.length;
  const totalLikes = posts.reduce((sum, post) => sum + (post.likes?.length || 0), 0);
  const totalComments = posts.reduce((sum, post) => sum + (post.comments?.length || 0), 0);

  const renderHeader = () => (
    <View style={[styles.profileHeader, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.topUsername, { color: theme.colors.text }]}>{user?.username || 'User'}</Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.avatarContainer}>
          {user?.avatar ? (
            <Image source={{ uri: getMediaUrl(user.avatar) }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{user?.username ? user.username.charAt(0).toUpperCase() : 'U'}</Text>
          )}
        </View>
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
        {user?.bio ? (
          <Text style={[styles.bioText, { color: theme.colors.text }]}>{user.bio}</Text>
        ) : null}
        {partner ? (
          <Text style={[styles.partnerText, { color: theme.colors.textSecondary }]}>
            <Ionicons name="heart" size={14} color="#ff6b81" /> Paired with {partner.username}
          </Text>
        ) : (
          <Text style={[styles.partnerText, { color: theme.colors.textSecondary }]}>No partner connected</Text>
        )}
      </View>
      
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.inputBackground }]} onPress={() => navigation.navigate('EditProfile')}>
          <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Edit profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.inputBackground }]} onPress={handleShareProfile}>
          <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Share profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPost = ({ item }) => {
    return (
      <View style={[styles.postCard, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
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
          <Image source={{ uri: `${STATIC_URL}${item.mediaUrl}` }} style={styles.feedPostImage} />
        )}
        
        <View style={styles.postFooter}>
          <View style={styles.actionButton}>
            <Ionicons name={item.likes?.includes(user?._id) ? "heart" : "heart-outline"} size={24} color={item.likes?.includes(user?._id) ? "#ff6b81" : theme.colors.textSecondary} />
            <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>{item.likes?.length || 0}</Text>
          </View>
          <View style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={22} color={theme.colors.textSecondary} />
            <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>{item.comments?.length || 0}</Text>
          </View>
        </View>
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
    backgroundColor: '#ffffff',
  },
  listContent: {
    paddingBottom: 40,
  },
  profileHeader: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
    paddingBottom: 15,
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
    color: '#1a1a1a',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ff6b81',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 30,
    overflow: 'hidden',
  },
  avatarText: {
    fontSize: 32,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: 13,
    color: '#1a1a1a',
  },
  bioSection: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  name: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  bioText: {
    fontSize: 14,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  partnerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#f1f1f1',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
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
    paddingHorizontal: 20,
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
    paddingHorizontal: 20,
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
    height: 200,
    borderRadius: 12,
    marginBottom: 12
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f1f1',
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
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '600',
    color: '#ccc',
  }
});
