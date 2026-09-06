import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance from '../api/axiosConfig';
import { useThemeContext } from '../context/ThemeContext';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { theme } = useThemeContext();

  const handleRequestOTP = async () => {
    if (!email) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter your email.' });
      return;
    }

    setLoading(true);
    try {
      // Request notification permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      const response = await axiosInstance.post('/auth/forgot-password', { email });
      
      const mockOtp = response.data?.mockOtp;
      if (mockOtp) {
        Toast.show({ type: 'success', text1: 'OTP Generated', text2: `Your OTP is: ${mockOtp} (check notifications)` });
        
        if (finalStatus === 'granted') {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "🔒 HandS OTP Verification",
              body: `Your OTP code is: ${mockOtp}\nDo not share this with anyone.`,
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: null,
          });
        }
      } else {
        Toast.show({ type: 'success', text1: 'Success', text2: 'OTP sent to your email.' });
      }
      
      navigation.navigate('VerifyOTP', { email });
    } catch (error) {
      Toast.show({ 
        type: 'error', 
        text1: 'Error', 
        text2: error.response?.data?.message || 'Failed to request OTP. Try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Forgot Password?</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Enter your email address to receive a 6-digit OTP code.</Text>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Email</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="bubu@example.com"
              placeholderTextColor={theme.colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.colors.primary, opacity: loading ? 0.7 : 1 }]} 
            activeOpacity={0.8} 
            onPress={handleRequestOTP} 
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  backButton: {
    padding: 20,
    marginTop: 10,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 40,
    fontWeight: '500',
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  button: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
