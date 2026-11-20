import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import axiosInstance, { getMediaUrl } from '../api/axiosConfig';
import { useThemeContext } from '../context/ThemeContext';

export default function FeedbackScreen() {
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState(5);
  const [image, setImage] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigation = useNavigation();
  const { theme } = useThemeContext();

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    try {
      const response = await axiosInstance.get('/feedbacks');
      setFeedbacks(response.data);
    } catch (error) {
      console.log('Error fetching feedbacks:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      setImage(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (feedbackText.trim() === '' && !image) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter feedback or attach an image.' });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('rating', String(rating));
      if (feedbackText.trim()) formData.append('text', feedbackText.trim());
      if (image) {
        formData.append('media', {
          uri: Platform.OS === 'ios' ? image.uri.replace('file://', '') : image.uri,
          name: 'feedback.jpg',
          type: 'image/jpeg'
        });
      }

      await axiosInstance.post('/feedbacks', formData);

      Toast.show({ type: 'success', text1: 'Thank You!', text2: 'Your feedback was submitted.' });
      setFeedbackText('');
      setRating(5);
      setImage(null);
      fetchFeedbacks();
    } catch (error) {
      console.log('Error submitting feedback:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to submit feedback' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderFeedbackItem = ({ item }) => (
    <View style={[styles.feedbackItem, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.fbHeader}>
        <Text style={[styles.fbUser, { color: theme.colors.text }]}>{item.user?.username || 'Anonymous'}</Text>
        <View style={styles.starsContainerSm}>
          {[1,2,3,4,5].map(i => (
            <Ionicons key={i} name={i <= item.rating ? "star" : "star-outline"} size={14} color="#FFD700" />
          ))}
        </View>
      </View>
      {item.text ? <Text style={[styles.fbText, { color: theme.colors.textSecondary }]}>{item.text}</Text> : null}
      {item.imageUrl ? (
        <Image source={{ uri: getMediaUrl(item.imageUrl) }} style={styles.fbImage} />
      ) : null}
      {item.devReply ? (
        <View style={styles.devReplyContainer}>
          <Text style={styles.devReplyTitle}>Developer Reply:</Text>
          <Text style={styles.devReplyText}>{item.devReply}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Feedback</Text>
          <View style={{ width: 44 }} />
        </View>

        <FlatList
          data={feedbacks}
          keyExtractor={item => item._id}
          renderItem={renderFeedbackItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.formContainer}>
              <Text style={[styles.title, { color: theme.colors.text }]}>We value your input</Text>
              
              <View style={styles.ratingContainer}>
                {[1,2,3,4,5].map(star => (
                  <TouchableOpacity key={star} onPress={() => setRating(star)}>
                    <Ionicons name={star <= rating ? "star" : "star-outline"} size={40} color="#FFD700" />
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border, color: theme.colors.text }]}
                multiline
                numberOfLines={4}
                placeholder="Share your thoughts..."
                placeholderTextColor={theme.colors.textSecondary}
                value={feedbackText}
                onChangeText={setFeedbackText}
                textAlignVertical="top"
              />

              <View style={styles.formRow}>
                <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                  <Ionicons name="image-outline" size={24} color="#ff6b81" />
                  <Text style={styles.imageBtnText}>{image ? 'Image Attached' : 'Attach Image'}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.button, submitting && styles.buttonDisabled]}
                  disabled={submitting}
                  onPress={handleSubmit}
                >
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit</Text>}
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Feedback</Text>
              {loading && <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 10 }} />}
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, marginBottom: 10,
  },
  backButton: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  formContainer: { marginBottom: 30 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  ratingContainer: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 },
  textInput: {
    borderWidth: 1,
    borderRadius: 16, padding: 15, fontSize: 16, minHeight: 120, marginBottom: 15
  },
  formRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  imageBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: 'rgba(255, 107, 129, 0.14)' },
  imageBtnText: { color: '#ff6b81', fontWeight: 'bold', marginLeft: 8 },
  button: { backgroundColor: '#ff6b81', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 20 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 40, marginBottom: 15 },
  feedbackItem: {
    borderRadius: 16, padding: 15, marginBottom: 15,
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2
  },
  fbHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  fbUser: { fontWeight: 'bold', fontSize: 16 },
  starsContainerSm: { flexDirection: 'row', gap: 2 },
  fbText: { fontSize: 15, marginBottom: 10 },
  fbImage: { width: '100%', height: 150, borderRadius: 10, marginBottom: 10, resizeMode: 'cover' },
  devReplyContainer: { backgroundColor: 'rgba(34, 197, 94, 0.14)', padding: 10, borderRadius: 10, marginTop: 5 },
  devReplyTitle: { fontWeight: 'bold', color: '#16a34a', fontSize: 13, marginBottom: 4 },
  devReplyText: { color: '#15803d', fontSize: 14 }
});
