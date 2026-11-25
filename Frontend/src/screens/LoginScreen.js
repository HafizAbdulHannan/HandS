import React, { useState, useEffect } from 'react';
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
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import { getMediaUrl } from '../api/axiosConfig';
import Toast from 'react-native-toast-message';

export default function LoginScreen() {
  const route = useRoute();
  const isAddingAccount = !!route.params?.isAddingAccount;
  const prefillEmail = route.params?.prefillEmail || '';

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState(null);

  const navigation = useNavigation();
  const { login, savedAccounts, switchAccount, removeSavedAccount } = useAuth();
  const { theme } = useThemeContext();

  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Toast.show({ type: 'error', text1: 'Missing Details', text2: 'Please enter email and password.' });
      return;
    }
    setIsLoading(true);
    try {
      await login(email.trim(), password);
      if (isAddingAccount) {
        Toast.show({ type: 'success', text1: 'Account Added', text2: 'Switched to the newly added account!' });
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: error.response?.data?.message || 'Something went wrong',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavedAccountLogin = async (account) => {
    setSwitchingId(account._id);
    try {
      await switchAccount(account._id);
      Toast.show({ type: 'success', text1: 'Welcome Back!', text2: `Logged in as @${account.username || account.email}` });
      if (isAddingAccount) {
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
    } catch (error) {
      setEmail(account.email || '');
      Toast.show({
        type: 'info',
        text1: 'Password Required',
        text2: error?.message || 'Please enter your password to log in.',
      });
    } finally {
      setSwitchingId(null);
    }
  };

  const handleSavedAccountRemove = (account) => {
    Alert.alert(
      'Remove Account',
      `Remove @${account.username || account.email} from saved accounts list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeSavedAccount(account._id);
            Toast.show({ type: 'info', text1: 'Removed', text2: 'Account removed from list.' });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
          {isAddingAccount && (
            <View style={styles.topBackRow}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={[styles.topBackTitle, { color: theme.colors.text }]}>Add Account</Text>
              <View style={{ width: 34 }} />
            </View>
          )}

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                {isAddingAccount ? 'Add Account' : 'Welcome Back'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                {isAddingAccount ? 'Log in to add another account to this device' : 'Log in to your private space'}
              </Text>

              {/* Saved Accounts List (When user has saved accounts on device) */}
              {!isAddingAccount && savedAccounts && savedAccounts.length > 0 && (
                <View style={[styles.savedBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <Text style={[styles.savedHeading, { color: theme.colors.text }]}>Saved Accounts</Text>
                  {savedAccounts.map((acc) => (
                    <View
                      key={acc._id}
                      style={[styles.savedRow, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}
                    >
                      <View style={styles.savedRowInfo}>
                        <View style={styles.savedAvatar}>
                          {acc.avatar ? (
                            <Image source={{ uri: getMediaUrl(acc.avatar) }} style={styles.savedAvatarImg} />
                          ) : (
                            <Text style={styles.savedAvatarInitial}>
                              {(acc.fullName || acc.username || 'U').charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.savedName, { color: theme.colors.text }]} numberOfLines={1}>
                            {acc.fullName || acc.username}
                          </Text>
                          <Text style={[styles.savedEmail, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                            @{acc.username} • {acc.email}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.savedActionsRow}>
                        <TouchableOpacity
                          style={[styles.savedLoginBtn, { backgroundColor: theme.colors.primary }]}
                          onPress={() => handleSavedAccountLogin(acc)}
                          disabled={switchingId === acc._id}
                        >
                          {switchingId === acc._id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.savedLoginText}>Login</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.savedRemoveBtn, { borderColor: 'rgba(255, 71, 87, 0.45)', backgroundColor: 'rgba(255, 71, 87, 0.1)' }]}
                          onPress={() => handleSavedAccountRemove(acc)}
                          disabled={switchingId === acc._id}
                        >
                          <Text style={styles.savedRemoveText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

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
                  {!isAddingAccount && (
                    <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotPasswordContainer}>
                      <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.button, { backgroundColor: theme.colors.primary, opacity: isLoading ? 0.7 : 1 }]}
                  activeOpacity={0.8}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{isAddingAccount ? 'Add & Log In' : 'Log In'}</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.footer}>
                  <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>Don't have an account? </Text>
                  <TouchableOpacity
                    onPress={() =>
                      isAddingAccount
                        ? navigation.navigate('AddAccountSignup', { isAddingAccount: true })
                        : navigation.navigate('Signup')
                    }
                  >
                    <Text style={[styles.footerLink, { color: theme.colors.primary }]}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              </View>
          </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    keyboardView: { flex: 1 },
    topBackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    backBtn: { padding: 4 },
    topBackTitle: { fontSize: 18, fontWeight: '700' },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingVertical: 20,
      paddingBottom: 60,
    },
    content: {
      paddingHorizontal: 26,
      paddingBottom: 40,
    },
    title: {
      fontSize: 34,
      fontWeight: '800',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      marginBottom: 28,
      fontWeight: '500',
    },
      savedBox: {
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        marginBottom: 24,
      },
        savedHeading: {
          fontSize: 15,
          fontWeight: '800',
          marginBottom: 10,
        },
        savedRow: {
          borderRadius: 14,
          padding: 12,
          borderWidth: 1,
          marginBottom: 10,
        },
        savedRowInfo: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 10,
        },
        savedAvatar: {
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: '#ff6b81',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 10,
          overflow: 'hidden',
        },
        savedAvatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
        savedAvatarInitial: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
        savedName: { fontSize: 15, fontWeight: '700' },
        savedEmail: { fontSize: 12, marginTop: 1 },
        savedActionsRow: {
          flexDirection: 'row',
          gap: 10,
        },
        savedLoginBtn: {
          flex: 1,
          paddingVertical: 9,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
        },
        savedLoginText: { color: '#fff', fontWeight: '700', fontSize: 13 },
        savedRemoveBtn: {
          flex: 1,
          paddingVertical: 9,
          borderRadius: 10,
          borderWidth: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        savedRemoveText: { color: '#ff4757', fontWeight: '700', fontSize: 13 },
        inputContainer: { marginBottom: 20 },
        label: { fontSize: 14, marginBottom: 8, fontWeight: '600', marginLeft: 4 },
        input: {
          borderWidth: 1,
          borderRadius: 16,
          padding: 16,
          fontSize: 16,
        },
        passwordContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderRadius: 16,
        },
        passwordInput: { flex: 1, padding: 16, fontSize: 16 },
        eyeIcon: { padding: 16 },
        forgotPasswordContainer: { alignItems: 'flex-end', marginTop: 10, marginRight: 4 },
        forgotPasswordText: { color: '#ff6b81', fontSize: 14, fontWeight: '600' },
        button: {
          paddingVertical: 17,
          borderRadius: 20,
          alignItems: 'center',
          marginTop: 14,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 6,
        },
        buttonText: { color: '#ffffff', fontSize: 17, fontWeight: 'bold', letterSpacing: 0.5 },
        footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
        footerText: { fontSize: 15 },
        footerLink: { fontSize: 15, fontWeight: 'bold' },
      });
