import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import axiosInstance from '../api/axiosConfig';
import Toast from 'react-native-toast-message';

export default function SettingScreen() {
  const navigation = useNavigation();
  const { user, logout, loadUser } = useAuth();
  const { isDarkMode, toggleTheme, theme } = useThemeContext();

  const handleLogout = async () => {
    await logout();
  };

  const handleUnpair = () => {
    Alert.alert(
      "Disconnect Partner",
      "Are you sure you want to disconnect from your partner? You will no longer see their posts or be able to chat with them.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Disconnect", 
          style: "destructive",
          onPress: async () => {
            try {
              await axiosInstance.post('/pairing/disconnect');
              await loadUser();
              Toast.show({ type: 'success', text1: 'Success', text2: 'Disconnected from partner' });
            } catch (error) {
              console.log('Disconnect error:', error);
              Toast.show({ type: 'error', text1: 'Error', text2: 'Could not disconnect' });
            }
          }
        }
      ]
    );
  };

  const handleCameraAccess = () => {
    Linking.openSettings();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Settings</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.menuContainer, { backgroundColor: theme.colors.card }]}>
          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
            onPress={() => navigation.navigate('Feedback')}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Provide Feedback</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
            onPress={toggleTheme}
          >
            <Ionicons name={isDarkMode ? "sunny-outline" : "moon-outline"} size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>{isDarkMode ? "Light Mode" : "Dark Mode"}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
            onPress={() => {
              navigation.navigate('Location');
            }}
          >
            <Ionicons name="location-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Location Sharing</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
            onPress={handleCameraAccess}
          >
            <Ionicons name="camera-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Camera Access</Text>
          </TouchableOpacity>

          {user?.partner && (
            <TouchableOpacity 
              style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
              onPress={handleUnpair}
            >
              <Ionicons name="heart-dislike-outline" size={22} color="#ff9f43" style={styles.menuIcon} />
              <Text style={[styles.menuText, { color: '#ff9f43' }]}>Disconnect Partner</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={22} color={theme.colors.icon} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Log Out</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomWidth: 0 }]} 
            onPress={() => {}}
          >
            <Ionicons name="trash-outline" size={22} color="#ff4757" style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: '#ff4757' }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  menuContainer: {
    borderRadius: 15,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
  }
});
