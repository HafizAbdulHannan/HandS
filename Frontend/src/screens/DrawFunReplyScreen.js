import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useThemeContext } from '../context/ThemeContext';
import axiosInstance, { STATIC_URL } from '../api/axiosConfig';
import Toast from 'react-native-toast-message';
import Animated, { FadeInUp, SlideInDown } from 'react-native-reanimated';

export default function DrawFunReplyScreen() {
  const { theme } = useThemeContext();
  const navigation = useNavigation();
  const route = useRoute();
  const { postId } = route.params;

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPost();
  }, []);

  const fetchPost = async () => {
    try {
      const res = await axiosInstance.get('/posts');
      const foundPost = res.data.find(p => p._id === postId);
      if (foundPost) {
        setPost(foundPost);
      }
    } catch (err) {
      console.log('Error fetching drawing', err);
    } finally {
      setLoading(false);
    }
  };

  const sendReaction = async (emoji) => {
    try {
      await axiosInstance.post(`/posts/${postId}/comment`, {
        text: emoji
      });
      Toast.show({ type: 'success', text1: 'Sent!', text2: `Reacted with ${emoji}` });
      navigation.goBack();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not send reaction' });
    }
  };

  const handleDrawReply = () => {
    navigation.navigate('DrawFun');
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.text }}>Drawing not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: theme.colors.primary }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const imageUrl = `${STATIC_URL}${post.mediaUrl}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <Animated.View entering={FadeInUp} style={[styles.header, { zIndex: 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>From {post.author?.username}</Text>
        <View style={{ width: 44 }} />
      </Animated.View>

      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" />
      </View>

      <Animated.View entering={SlideInDown.delay(300)} style={styles.replySection}>
        <Text style={styles.replyText}>Send a quick reaction</Text>
        <View style={styles.reactionRow}>
          {['😍', '😂', '🔥', '😲', '🥺'].map(emoji => (
            <TouchableOpacity key={emoji} onPress={() => sendReaction(emoji)} style={styles.reactionBtn}>
              <Text style={{ fontSize: 32 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.drawReplyBtn} onPress={handleDrawReply}>
          <Ionicons name="color-palette" size={24} color="#fff" style={{ marginRight: 10 }} />
          <Text style={styles.drawReplyText}>Draw a Reply</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'absolute',
    top: 50,
    width: '100%'
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
  },
  iconBtn: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20
  },
  imageContainer: {
    flex: 1,
    backgroundColor: '#000'
  },
  replySection: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 20,
    paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    alignItems: 'center'
  },
  replyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15
  },
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    marginBottom: 25
  },
  reactionBtn: {
    padding: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 30,
  },
  drawReplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6b81',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 30,
    width: '100%',
    justifyContent: 'center',
    shadowColor: '#ff6b81',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  drawReplyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  }
});
