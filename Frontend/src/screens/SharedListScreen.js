import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axiosInstance from '../api/axiosConfig';
import Toast from 'react-native-toast-message';

export default function SharedListScreen() {
  const navigation = useNavigation();
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
      const response = await axiosInstance.post('/lists', { text: newItemText });
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.title}>Shared List</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add an item..."
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
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <TouchableOpacity style={styles.checkBtn} onPress={() => handleToggle(item._id)}>
                <Ionicons name={item.completed ? "checkmark-circle" : "ellipse-outline"} size={28} color={item.completed ? "#4CD964" : "#ccc"} />
              </TouchableOpacity>
              <Text style={[styles.itemText, item.completed && styles.itemTextCompleted]}>{item.text}</Text>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item._id)}>
                <Ionicons name="trash-outline" size={20} color="#ff6b81" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Your shared list is empty.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfcfc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f1f1', backgroundColor: '#fff',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f3f5', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a' },
  inputContainer: { flexDirection: 'row', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  input: { flex: 1, backgroundColor: '#f1f3f5', borderRadius: 12, paddingHorizontal: 15, height: 48, fontSize: 16 },
  addBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#ff6b81', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  listContent: { padding: 20 },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  checkBtn: { marginRight: 15 },
  itemText: { flex: 1, fontSize: 16, color: '#1a1a1a' },
  itemTextCompleted: { textDecorationLine: 'line-through', color: '#aaa' },
  deleteBtn: { padding: 5 },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 30 }
});
