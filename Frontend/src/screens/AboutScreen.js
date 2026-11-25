import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance from '../api/axiosConfig';
import { useThemeContext } from '../context/ThemeContext';

export default function AboutScreen() {
  const navigation = useNavigation();
  const { theme } = useThemeContext();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ avgRating: 5, total: 0 });
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const fetchFeedbackData = async () => {
      try {
        const response = await axiosInstance.get('/feedbacks');
        const allFeedbacks = response.data;

        if (allFeedbacks.length > 0) {
          const totalRating = allFeedbacks.reduce((sum, fb) => sum + fb.rating, 0);
          const avg = (totalRating / allFeedbacks.length).toFixed(1);
          setStats({ avgRating: avg, total: allFeedbacks.length });

          const textReviews = allFeedbacks.filter(fb => fb.text && fb.text.trim().length > 0).slice(0, 3);
          setReviews(textReviews);
        }
      } catch (error) {
        console.log('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeedbackData();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>About Us</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>H&S</Text>
          <Text style={[styles.version, { color: theme.colors.textSecondary }]}>Version 1.0.13</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Developer Details</Text>
          <View style={styles.row}>
            <Ionicons name="person-outline" size={20} color="#ff6b81" />
            <Text style={[styles.rowText, { color: theme.colors.text }]}>Hafiz Abdul Hannan</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="mail-outline" size={20} color="#ff6b81" />
            <Text style={[styles.rowText, { color: theme.colors.text }]}>hannanitx@gmail.com</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={20} color="#ff6b81" />
            <Text style={[styles.rowText, { color: theme.colors.text }]}>Built with ❤️ in Pakistan</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Ratings & Reviews</Text>

          {loading ? (
            <ActivityIndicator color="#ff6b81" />
          ) : (
            <>
              <View style={styles.ratingRow}>
                <Text style={[styles.ratingNumber, { color: theme.colors.text }]}>{stats.avgRating}</Text>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Ionicons
                      key={star}
                      name={star <= Math.round(stats.avgRating) ? "star" : "star-outline"}
                      size={20}
                      color="#FFD700"
                    />
                  ))}
                </View>
              </View>
              <Text style={[styles.reviewCount, { color: theme.colors.textSecondary }]}>Based on {stats.total} reviews</Text>

              {reviews.map(review => (
                <View key={review._id} style={[styles.reviewBox, { backgroundColor: theme.colors.inputBackground }]}>
                  <Text style={[styles.reviewAuthor, { color: theme.colors.text }]}>{review.user?.username || 'Anonymous'}</Text>
                  <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <Ionicons key={i} name={i <= review.rating ? "star" : "star-outline"} size={12} color="#FFD700" />
                    ))}
                  </View>
                  <Text style={[styles.reviewText, { color: theme.colors.textSecondary }]}>{review.text}</Text>
                </View>
              ))}
            </>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 24, paddingBottom: 40 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoText: { fontSize: 48, fontWeight: '900', color: '#ff6b81', letterSpacing: 2 },
  version: { fontSize: 14, marginTop: 5 },
  card: { borderRadius: 20, padding: 24, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  rowText: { fontSize: 16, marginLeft: 12, fontWeight: '500' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  ratingNumber: { fontSize: 32, fontWeight: '900', marginRight: 10 },
  stars: { flexDirection: 'row' },
  reviewCount: { fontSize: 14, marginBottom: 20 },
  reviewBox: { padding: 16, borderRadius: 12, marginBottom: 10 },
  reviewAuthor: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  reviewText: { fontSize: 14, lineHeight: 20 }
});
