import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance from '../api/axiosConfig';
import { useThemeContext } from '../context/ThemeContext';
import Toast from 'react-native-toast-message';

export default function VerifyOTPScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const email = route.params?.email || '';

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme } = useThemeContext();

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter a valid 6-digit OTP.' });
      return;
    }

    setLoading(true);
    try {
      await axiosInstance.post('/auth/verify-otp', { email, otp });
      Toast.show({ type: 'success', text1: 'Verified', text2: 'OTP verified successfully.' });
      navigation.navigate('ResetPassword', { email, otp });
    } catch (error) {
      Toast.show({ 
        type: 'error', 
        text1: 'Verification Failed', 
        text2: error.response?.data?.message || 'Invalid or expired OTP.' 
      });
      // Fallback to ForgotPassword on failure as requested
      navigation.navigate('ForgotPassword');
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
            <Text style={[styles.title, { color: theme.colors.text }]}>Verify OTP</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Enter the 6-digit OTP sent to {email}.</Text>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.text }]}>OTP Code</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="123456"
                placeholderTextColor={theme.colors.textSecondary}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: theme.colors.primary, opacity: loading ? 0.7 : 1 }]} 
              activeOpacity={0.8} 
              onPress={handleVerifyOTP} 
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify OTP</Text>
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
