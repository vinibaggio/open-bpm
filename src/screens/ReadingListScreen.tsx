import { useCallback, useState } from 'react';
import { FlatList, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Reading } from '../types/reading';
import { getAllReadings, deleteAllReadings } from '../services/database/readingRepository';
import ReadingRow from '../components/ReadingRow';
import { scanForOmron, syncReadings } from '../services/ble/bleSync';

export default function ReadingListScreen() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getAllReadings().then(setReadings);
    }, [])
  );

  async function handleSync() {
    setSyncing(true);
    setStatus('Scanning...');
    try {
      const device = await scanForOmron(setStatus);
      const imported = await syncReadings(device, setStatus);
      if (imported > 0) {
        const updated = await getAllReadings();
        setReadings(updated);
      }
      setTimeout(() => setStatus(null), 3000);
    } catch (e: any) {
      Alert.alert('Sync Error', e.message || 'Failed to sync.');
      setStatus(null);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeleteAll() {
    Alert.alert(
      'Delete All Readings',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await deleteAllReadings();
            setReadings([]);
          },
        },
      ]
    );
  }

  const syncButton = (
    <View style={styles.syncContainer}>
      {status && <Text style={styles.statusText}>{status}</Text>}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.syncBtn, syncing && styles.disabledBtn]}
          onPress={handleSync}
          disabled={syncing}
        >
          <Text style={styles.syncBtnText}>Sync from Monitor</Text>
        </TouchableOpacity>
        {readings.length > 0 && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAll}>
            <Text style={styles.deleteBtnText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (readings.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No readings yet.</Text>
        <Text style={styles.emptyHint}>
          Sync from your Omron monitor or use the Capture tab.
        </Text>
        {syncButton}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {syncButton}
      <FlatList
        data={readings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReadingRow reading={item} />}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#333' },
  emptyHint: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' },
  syncContainer: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  syncBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  syncBtnText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 15, color: '#F44336', fontWeight: '600' },
  disabledBtn: { opacity: 0.5 },
  statusText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
});
