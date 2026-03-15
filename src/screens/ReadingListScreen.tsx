import { useCallback, useState } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Reading } from '../types/reading';
import { getAllReadings } from '../services/database/readingRepository';
import ReadingRow from '../components/ReadingRow';

export default function ReadingListScreen() {
  const [readings, setReadings] = useState<Reading[]>([]);

  useFocusEffect(
    useCallback(() => {
      getAllReadings().then(setReadings);
    }, [])
  );

  if (readings.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No readings yet.</Text>
        <Text style={styles.emptyHint}>Use the Capture tab to add your first reading.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={readings}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ReadingRow reading={item} />}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#fff' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#333' },
  emptyHint: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' },
});
