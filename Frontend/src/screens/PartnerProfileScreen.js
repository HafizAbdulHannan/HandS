import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, RefreshControl, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import axiosInstance, { STATIC_URL } from '../api/axiosConfig';
import Toast from 'react-native-toast-message';

export default function PartnerProfileScreen() {
  const { user } = useAuth();
  const { theme } = useThemeContext();
  const navigation = useNavigation();
  
  const [partner, setPartner] = useState(null);
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  useEffect(() => {
    fetchPartner();
  }, []);

  const fetchPartner = async () => {
    if (user?.partner) {
      try {
        const response = await axiosInstance.get('/pairing/partner');
        setPartner(response.data);
      } catch (error) {
        console.log('Error fetching partner:', error);
      }
    }
  };

  const fetchPosts = async () => {
    if (!partner) return;
    try {
      const response = await axiosInstance.get('/posts');
      const partnerPosts = response.data.filter(p => p.author?._id === partner._id);
      setPosts(partnerPosts);
    } catch (error) {
      console.log('Error fetching posts:', error);
    }
  };

  useEffect(() => {
    if (partner) {
      fetchPosts();
    }
  }, [partner]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
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

  const totalPosts = posts.length;
  const totalLikes = posts.reduce((sum, post) => sum + (post.likes?.length || 0), 0);
  const totalComments = posts.reduce((sum, post) => sum + (post.comments?.length || 0), 0);

  const renderHeader = () => {
    if (!partner) return null;
    return (
      <View style={[styles.profileHeader, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.topUsername, { color: theme.colors.text }]}>{partner.username || 'Partner'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.infoSection}>
          <View style={[styles.avatarContainer, { overflow: 'hidden' }]}>
            {partner.avatar ? (
              <Image source={{ uri: `${STATIC_URL}${partner.avatar}` }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
            ) : (
              <Text style={styles.avatarText}>{partner.username ? partner.username.charAt(0).toUpperCase() : 'P'}</Text>
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
          <Text style={[styles.name, { color: theme.colors.text }]}>{partner.username || 'Partner'}</Text>
          <Text style={[styles.email, { color: theme.colors.textSecondary }]}>{partner.email || ''}</Text>
          <Text style={[styles.partnerText, { color: theme.colors.textSecondary }]}>
            <Ionicons name="heart" size={14} color="#ff6b81" /> Paired with you
          </Text>
        </View>
      </View>
    );
  };

  const renderPost = ({ item }) => {
    return (
      <View style={[styles.postCard, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <View style={styles.postHeader}>
          <View style={[styles.avatarPlaceholder, { overflow: 'hidden' }]}>
            {item.author?.avatar ? (
              <Image source={{ uri: `${STATIC_URL}${item.author.avatar}` }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
            ) : (
              <Text style={styles.avatarLetter}>{item.author?.username?.charAt(0).toUpperCase() || 'P'}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.postAuthor, { color: theme.colors.text }]}>{item.author?.username || 'Partner'}</Text>
            <Text style={[styles.postTime, { color: theme.colors.textSecondary }]}>{new Date(item.createdAt).toLocaleString()}</Text>
          </View>
        </View>
        
        {item.content ? <Text style={[styles.postText, { color: theme.colors.text }]}>{item.content}</Text> : null}
        
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
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {partner ? (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={renderHeader}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={60} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No posts from partner yet</Text>
            </View>
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Partner data not found.</Text>
        </View>
      )}
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
  backBtn: {
    padding: 5,
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
    backgroundColor: '#ff9ff3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 30,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
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
  },
  name: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 2,
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
  avatarPlaceholder: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 14,
    backgroundColor: '#ff9ff3'
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
  postImage: {
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
