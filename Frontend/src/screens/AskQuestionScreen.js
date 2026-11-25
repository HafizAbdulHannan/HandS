import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import axiosInstance, { getMediaUrl } from '../api/axiosConfig';
import { useThemeContext } from '../context/ThemeContext';

export default function AskQuestionScreen() {
  const [questionText, setQuestionText] = useState('');
  const [image, setImage] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigation = useNavigation();
  const { theme } = useThemeContext();

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await axiosInstance.get('/questions');
      setQuestions(response.data);
    } catch (error) {
      console.log('Error fetching questions:', error);
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
    if (questionText.trim() === '') {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a question.' });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('questionText', questionText.trim());
      if (image) {
        formData.append('media', {
          uri: Platform.OS === 'ios' ? image.uri.replace('file://', '') : image.uri,
          name: 'question.jpg',
          type: 'image/jpeg'
        });
      }

      await axiosInstance.post('/questions', formData);

      Toast.show({ type: 'success', text1: 'Sent!', text2: 'The developer will reply soon.' });
      setQuestionText('');
      setImage(null);
      fetchQuestions();
    } catch (error) {
      console.log('Error submitting question:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to submit question' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestionItem = ({ item }) => (
    <View style={[styles.qItem, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <Text style={[styles.qUser, { color: theme.colors.textSecondary }]}>You Asked:</Text>
      <Text style={[styles.qText, { color: theme.colors.text }]}>{item.questionText}</Text>
      {item.imageUrl ? (
        <Image source={{ uri: getMediaUrl(item.imageUrl) }} style={styles.qImage} />
      ) : null}

      {item.devReply ? (
        <View style={styles.devReplyContainer}>
          <Text style={styles.devReplyTitle}>Developer Answer:</Text>
          <Text style={styles.devReplyText}>{item.devReply}</Text>
        </View>
      ) : (
        <View style={styles.waitingContainer}>
          <Text style={styles.waitingText}>Waiting for response...</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Ask a Question</Text>
          <View style={{ width: 44 }} />
        </View>

        <FlatList
          data={questions}
          keyExtractor={item => item._id}
          renderItem={renderQuestionItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: 60 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.formContainer}>
              <Text style={[styles.title, { color: theme.colors.text }]}>Have a question?</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Ask the developer anything! Attach screenshots if you need help with a bug.</Text>

              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border, color: theme.colors.text }]}
                multiline
                numberOfLines={4}
                placeholder="Type your question..."
                placeholderTextColor={theme.colors.textSecondary}
                value={questionText}
                onChangeText={setQuestionText}
                textAlignVertical="top"
              />

              <View style={styles.formRow}>
                <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                  <Ionicons name="image-outline" size={24} color="#6c5ce7" />
                  <Text style={styles.imageBtnText}>{image ? 'Screenshot Attached' : 'Attach Screenshot'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, submitting && styles.buttonDisabled]}
                  disabled={submitting}
                  onPress={handleSubmit}
                >
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit</Text>}
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Previous Questions</Text>
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
  title: { fontSize: 24, fontWeight: '800', marginBottom: 5 },
  subtitle: { fontSize: 14, marginBottom: 20 },
  textInput: {
    borderWidth: 1,
    borderRadius: 16, padding: 15, fontSize: 16, minHeight: 120, marginBottom: 15
  },
  formRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  imageBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: 'rgba(108, 92, 231, 0.14)' },
  imageBtnText: { color: '#6c5ce7', fontWeight: 'bold', marginLeft: 8 },
  button: { backgroundColor: '#6c5ce7', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 20 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 40, marginBottom: 15 },
  qItem: {
    borderRadius: 16, padding: 15, marginBottom: 15,
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2
  },
  qUser: { fontWeight: 'bold', fontSize: 14, marginBottom: 5 },
  qText: { fontSize: 16, marginBottom: 10 },
  qImage: { width: '100%', height: 150, borderRadius: 10, marginBottom: 10, resizeMode: 'cover' },
  devReplyContainer: { backgroundColor: 'rgba(108, 92, 231, 0.14)', padding: 10, borderRadius: 10, marginTop: 5 },
  devReplyTitle: { fontWeight: 'bold', color: '#6c5ce7', fontSize: 13, marginBottom: 4 },
  devReplyText: { color: '#6c5ce7', fontSize: 14 },
  waitingContainer: { backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: 10, borderRadius: 10, marginTop: 5 },
  waitingText: { color: '#d97706', fontSize: 13, fontStyle: 'italic' }
});
