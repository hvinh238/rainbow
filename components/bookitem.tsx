// components/BookItem.tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';

interface Book {
  title: string;
  author_name?: string[];
  cover_i?: number;
  key: string;
}

interface BookItemProps {
  book: Book;
  onPress: () => void;
}

export default function BookItem({ book, onPress }: BookItemProps) {
  const coverUrl = book.cover_i 
    ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`  // Size medium
    : null;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      {coverUrl && (
        <Image source={{ uri: coverUrl }} style={styles.cover} />
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
        {book.author_name && (
          <Text style={styles.author}>Tác giả: {book.author_name[0]}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
  },
  cover: {
    width: 60,
    height: 80,
    marginRight: 12,
    borderRadius: 4,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  author: {
    fontSize: 14,
    color: '#666',
  },
});