import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import Toast from 'react-native-toast-message';

export default function SignupScreen() {
  const route = useRoute();
  const isAddingAccount = !!route.params?.isAddingAccount;

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);


  const navigation = useNavigation();
  const { register } = useAuth();
  const { theme } = useThemeContext();

  const handleSignup = async () => {
      if (!fullName.trim() || !username.trim() || !phoneNumber.trim() || !email.trim() || !password || !confirmPassword) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Please fill all fields!' });
        return;
      }
      if (password !== confirmPassword) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Passwords do not match!' });
        return;
      }


      setIsLoading(true);
      try {
        await register(fullName.trim(), username.trim(), phoneNumber.trim(), email.trim(), password);
        if (isAddingAccount) {
          Toast.show({ type: 'success', text1: 'Account Created', text2: 'New account created and saved!' });
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        }
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Signup Failed', text2: error.response?.data?.message || 'Something went wrong' });
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
            <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              {isAddingAccount && (
                <View style={styles.topBackRow}>
                  <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                  <Text style={[styles.topBackTitle, { color: theme.colors.text }]}>Create New Account</Text>
                  <View style={{ width: 34 }} />
                </View>
              )}

              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.content}>
                  <Text style={[styles.title, { color: theme.colors.text }]}>Create Account</Text>
                  <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                    {isAddingAccount ? 'Create and add another account on this device' : 'Join H&S to connect with your partner'}
                  </Text>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Full Name</Text>
              <TextInput
                      style={[styles.input, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }]}
                      placeholder="e.g. Bubu Ali"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Username</Text>
              <TextInput
                      style={[styles.input, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }]}
                      placeholder="e.g. Bubu"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Phone Number</Text>
              <TextInput
                      style={[styles.input, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }]}
                      placeholder="+92 300 1234567"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                    />
                  </View>

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

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Password</Text>
                    <View style={[styles.passwordContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <TextInput
                        style={[styles.passwordInput, { color: theme.colors.text }]}
                        placeholder="••••••••"
                        placeholderTextColor={theme.colors.textSecondary}
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={setPassword}
                      />
                        <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Confirm Password</Text>
                    <View style={[styles.passwordContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <TextInput
                        style={[styles.passwordInput, { color: theme.colors.text }]}
                        placeholder="••••••••"
                        placeholderTextColor={theme.colors.textSecondary}
                        secureTextEntry={!showConfirmPassword}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                      />
                        <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                          <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                  </View>

            <TouchableOpacity
                    style={[styles.button, { backgroundColor: theme.colors.primary, opacity: isLoading ? 0.7 : 1 }]}
                    activeOpacity={0.8}
                    onPress={handleSignup}
                    disabled={isLoading}
                  >
                    {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign Up</Text>}
                  </TouchableOpacity>

                  <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>Already have an account? </Text>
                      <TouchableOpacity
                        onPress={() =>
                          isAddingAccount
                            ? navigation.navigate('AddAccountLogin', { isAddingAccount: true })
                            : navigation.navigate('Login')
                        }
                      >
                        <Text style={[styles.footerLink, { color: theme.colors.primary }]}>Log In</Text>
                      </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
          );
}

          const styles = StyleSheet.create({
          container: {flex: 1 },
          keyboardView: {flex: 1 },
          topBackRow: {
            flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 18,
          paddingVertical: 12,
  },
          backBtn: {padding: 4 },
          topBackTitle: {fontSize: 18, fontWeight: '700' },
          scrollContent: {
            flexGrow: 1,
          justifyContent: 'center',
          paddingVertical: 20,
          paddingBottom: 60,
  },
          content: {paddingHorizontal: 26, paddingBottom: 40 },
          title: {fontSize: 34, fontWeight: '800', marginBottom: 8 },
          subtitle: {fontSize: 15, marginBottom: 30, fontWeight: '500' },
          inputContainer: {marginBottom: 18 },
          label: {fontSize: 14, marginBottom: 8, fontWeight: '600', marginLeft: 4 },
          input: {borderWidth: 1, borderRadius: 16, padding: 15, fontSize: 16 },
          passwordContainer: {flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16 },
          passwordInput: {flex: 1, padding: 15, fontSize: 16 },
          eyeIcon: {padding: 15 },
          button: {
          paddingVertical: 17,
          borderRadius: 20,
          alignItems: 'center',
          marginTop: 16,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 6 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 6,
  },
          buttonText: {color: '#ffffff', fontSize: 17, fontWeight: 'bold', letterSpacing: 0.5 },
          footer: {flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
          footerText: {fontSize: 15 },
          footerLink: {fontSize: 15, fontWeight: 'bold' },
});
