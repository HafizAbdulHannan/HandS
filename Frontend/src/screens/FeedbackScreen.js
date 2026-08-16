import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

export default function FeedbackScreen() {
  const [feedback, setFeedback] = useState('');
  const navigation = useNavigation();

  const handleSubmit = () => {
    if (feedback.trim() === '') {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter your feedback before submitting.' });
      return;
    }
    // API logic to submit feedback goes here
    Toast.show({ 
        type: 'success', 
        text1: 'Thank You!', 
        text2: 'Your feedback helps us improve H&S.',
        onHide: () => navigation.goBack() 
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Feedback</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>We'd love to hear from you</Text>
          <Text style={styles.subtitle}>
            Got suggestions, found a bug, or just want to share some love? Let us know!
          </Text>

          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={8}
            placeholder="Type your feedback here..."
            placeholderTextColor="#aaa"
            value={feedback}
            onChangeText={setFeedback}
            textAlignVertical="top"
          />

          <TouchableOpacity 
            style={[styles.button, feedback.trim() === '' && styles.buttonDisabled]}
            activeOpacity={0.8}
            onPress={handleSubmit}
          >
            <Text style={styles.buttonText}>Submit Feedback</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backIcon: {
    fontSize: 40,
    color: '#1a1a1a',
    lineHeight: 44,
    marginTop: -8, // slight optical adjustment for chevron
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 30,
  },
  textInput: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 16,
    padding: 20,
    fontSize: 16,
    color: '#333',
    minHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  button: {
    backgroundColor: '#ff6b81',
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 40,
    shadowColor: '#ff6b81',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonDisabled: {
    backgroundColor: '#ffb3c1',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
