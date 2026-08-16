import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function AboutScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>H&S</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Developer Details</Text>
          <View style={styles.row}>
            <Ionicons name="person-outline" size={20} color="#ff6b81" />
            <Text style={styles.rowText}>Hafiz Abdul Hannan</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="mail-outline" size={20} color="#ff6b81" />
            <Text style={styles.rowText}>contact@example.com</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={20} color="#ff6b81" />
            <Text style={styles.rowText}>Built with ❤️ in Pakistan</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ratings & Reviews</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingNumber}>4.9</Text>
            <View style={styles.stars}>
              <Ionicons name="star" size={20} color="#FFD700" />
              <Ionicons name="star" size={20} color="#FFD700" />
              <Ionicons name="star" size={20} color="#FFD700" />
              <Ionicons name="star" size={20} color="#FFD700" />
              <Ionicons name="star-half" size={20} color="#FFD700" />
            </View>
          </View>
          <Text style={styles.reviewCount}>Based on 12k reviews</Text>
          
          <View style={styles.reviewBox}>
            <Text style={styles.reviewAuthor}>"Best app for couples!"</Text>
            <Text style={styles.reviewText}>This app completely changed how we stay connected. The private gallery is amazing.</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
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
    color: '#1a1a1a',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#ff6b81',
    letterSpacing: 2,
  },
  version: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rowText: {
    fontSize: 16,
    color: '#444',
    marginLeft: 12,
    fontWeight: '500',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingNumber: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1a1a1a',
    marginRight: 10,
  },
  stars: {
    flexDirection: 'row',
  },
  reviewCount: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },
  reviewBox: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
  },
  reviewAuthor: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  reviewText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  }
});
