import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../context/ThemeContext';

export default function PolicyScreen() {
  const navigation = useNavigation();
  const { theme } = useThemeContext();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Privacy Policy</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lastUpdated, { color: theme.colors.textSecondary }]}>Last Updated: November 2026</Text>
        
        <Text style={[styles.title, { color: theme.colors.text }]}>Privacy Policy & Terms of Service</Text>
        
        <Text style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
          Welcome to H&S, the private couple's companion app ("we," "our," or "us"). Your privacy and the security of your intimate data are our absolute highest priorities. This Privacy Policy outlines how we collect, use, protect, and handle your personal information when you use our mobile application and related services.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>1. Information We Collect</Text>
        <Text style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
          <Text style={[styles.bold, { color: theme.colors.text }]}>Account Information:</Text> We collect your name, email address, password, and the unique connection code used to securely pair your account with your partner's account.
        </Text>
        <Text style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
          <Text style={[styles.bold, { color: theme.colors.text }]}>Communications & Media:</Text> Messages, voice notes, photos, drawings, mood updates, and shared lists transmitted through our real-time socket connections are processed by our servers.
        </Text>
        <Text style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
          <Text style={[styles.bold, { color: theme.colors.text }]}>Location Data:</Text> If you explicitly opt-in to Location Sharing, we collect GPS coordinates to securely display your real-time location exclusively to your paired partner.
        </Text>
        <Text style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
          <Text style={[styles.bold, { color: theme.colors.text }]}>Usage Data & Crash Logs:</Text> We collect anonymous diagnostic data to fix bugs, improve app stability, and enhance the user experience.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>2. How We Use Your Information</Text>
        <Text style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
          We strictly use your information to operate the core functions of the H&S app, primarily to facilitate real-time synchronization between you and your partner. We do not sell, rent, or trade your personal data to any third parties. 
        </Text>
        
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>3. Data Security & Encryption</Text>
        <Text style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
          All real-time communications (chat, media, Watch Together rooms) are transmitted over secure WebSocket connections (WSS) and HTTPS protocols. We employ industry-standard encryption to protect your data in transit and at rest on our secure databases. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>4. Data Retention & Deletion</Text>
        <Text style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
          We retain your data only for as long as your account is active. You have the right to request the complete deletion of your account and associated data directly from the Settings menu. Upon account deletion, all personal data, chat logs, media, and pairing connections are permanently erased from our servers.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>5. Third-Party Services</Text>
        <Text style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
          We may employ third-party services (such as Agora for Watch Together rooms and AWS/Google Cloud for database hosting). These providers have access to your personal information only to perform specific tasks on our behalf and are obligated not to disclose or use it for any other purpose.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>6. Children's Privacy</Text>
        <Text style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
          Our services are not intended for use by individuals under the age of 18. We do not knowingly collect personal identifiable information from children under 18.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>7. Changes to This Policy</Text>
        <Text style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
          We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date at the top.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>8. Contact Us</Text>
        <Text style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
          If you have any questions or suggestions about our Privacy Policy or data handling practices, please do not hesitate to contact us at:
        </Text>
        <Text style={styles.emailText}>hannanitx@gmail.com</Text>
        
        <View style={styles.footerSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 24,
  },
  lastUpdated: {
    fontSize: 13,
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 30,
    lineHeight: 34,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 25,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 15,
  },
  bold: {
    fontWeight: '700',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff6b81',
    marginTop: 5,
  },
  footerSpace: {
    height: 40,
  }
});
