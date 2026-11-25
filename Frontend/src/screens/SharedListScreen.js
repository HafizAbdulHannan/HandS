import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemeContext } from '../context/ThemeContext';
import axiosInstance from '../api/axiosConfig';
import Toast from 'react-native-toast-message';

export default function SharedListScreen() {
  const navigation = useNavigation();
  const { theme } = useThemeContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newItemText, setNewItemText] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await axiosInstance.get('/lists');
      setItems(response.data);
    } catch (error) {
      console.log('Error fetching items', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItemText.trim()) return;
    setIsAdding(true);
    try {
      const response = await axiosInstance.post('/lists', { text: newItemText.trim() });
      setItems([response.data, ...items]);
      setNewItemText('');
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Failed to add item' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = async (id) => {
    setItems(items.map(item => item._id === id ? { ...item, completed: !item.completed } : item));
    try {
      await axiosInstance.put(`/lists/${id}/toggle`);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Failed to update item' });
      fetchItems();
    }
  };

  const handleDelete = async (id) => {
    setItems(items.filter(item => item._id !== id));
    try {
      await axiosInstance.delete(`/lists/${id}`);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Failed to delete item' });
      fetchItems();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.colors.inputBackground }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Shared List</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
            placeholder="Add an item..."
            placeholderTextColor={theme.colors.textSecondary}
            value={newItemText}
            onChangeText={setNewItemText}
            onSubmitEditing={handleAddItem}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddItem} disabled={isAdding || !newItemText.trim()}>
            {isAdding ? <ActivityIndicator color="#fff" /> : <Ionicons name="add" size={24} color="#fff" />}
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#ff6b81" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={item => item._id}
            contentContainerStyle={[styles.listContent, { paddingBottom: 50 }]}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <View style={[styles.itemCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <TouchableOpacity style={styles.checkBtn} onPress={() => handleToggle(item._id)}>
                  <Ionicons name={item.completed ? "checkmark-circle" : "ellipse-outline"} size={28} color={item.completed ? "#4CD964" : theme.colors.textSecondary} />
                </TouchableOpacity>
                <Text style={[styles.itemText, { color: theme.colors.text }, item.completed && { textDecorationLine: 'line-through', color: theme.colors.textSecondary }]}>
                  {item.text}
                </Text>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item._id)}>
                  <Ionicons name="trash-outline" size={20} color="#ff6b81" />
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Your shared list is empty.</Text>}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: 'bold' },
  inputContainer: { flexDirection: 'row', padding: 20, borderBottomWidth: 1 },
  input: { flex: 1, borderRadius: 12, paddingHorizontal: 15, height: 48, fontSize: 16 },
  addBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#ff6b81', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  listContent: { padding: 20 },
  itemCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  checkBtn: { marginRight: 15 },
  itemText: { flex: 1, fontSize: 16 },
  deleteBtn: { padding: 5 },
  emptyText: { textAlign: 'center', marginTop: 30 }
});
