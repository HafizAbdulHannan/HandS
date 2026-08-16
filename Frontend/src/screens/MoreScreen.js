import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemeContext } from '../context/ThemeContext';
import Animated, { FadeInUp } from 'react-native-reanimated';

export default function MoreScreen() {
  const { theme } = useThemeContext();
  const navigation = useNavigation();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>More</Text>
      </View>

      <View style={styles.content}>
        <Animated.View entering={FadeInUp.delay(100)}>
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} onPress={() => navigation.navigate('DatesToRemember')}>
            <Ionicons name="calendar-outline" size={24} color={theme.colors.text} style={styles.icon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Dates to Remember</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </Animated.View>
        
        <Animated.View entering={FadeInUp.delay(200)}>
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} onPress={() => navigation.navigate('WatchLobby')}>
            <Ionicons name="tv-outline" size={24} color={theme.colors.text} style={styles.icon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Watch together</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </Animated.View>
        
        <Animated.View entering={FadeInUp.delay(300)}>
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} onPress={() => navigation.navigate('DrawFun')}>
            <Ionicons name="color-palette-outline" size={24} color={theme.colors.text} style={styles.icon} />
            <Text style={[styles.menuText, { color: theme.colors.text }]}>Draw Fun</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    marginTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  icon: {
    marginRight: 15,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  }
});
