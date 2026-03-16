import { useCallback, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Reading } from '../types/reading';
import { getAllReadings, deleteAllReadings } from '../services/database/readingRepository';
import ReadingRow from '../components/ReadingRow';
import { scanForOmron, syncReadings } from '../services/ble/bleSync';

export default function ReadingListScreen() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getAllReadings().then((data) => {
        setReadings(data);
        setLoading(false);
      });
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (readings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyContent}>
          <Text style={styles.emptyIcon}>heartbeat</Text>
          <Text style={styles.emptyTitle}>No readings yet</Text>
          <Text style={styles.emptyHint}>
            Take a reading on your Omron monitor, then sync it here.
          </Text>
        </View>
        <View style={styles.emptyActions}>
          {status && (
            <View style={styles.statusBanner}>
              <ActivityIndicator size="small" color="#2196F3" style={{ marginRight: 8 }} />
              <Text style={styles.statusBannerText}>{status}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.syncBtnLarge, syncing && styles.disabledBtn]}
            onPress={handleSync}
            disabled={syncing}
          >
            <Text style={styles.syncBtnLargeText}>Sync from Monitor</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        {status ? (
          <View style={styles.statusBar}>
            <ActivityIndicator size="small" color="#2196F3" style={{ marginRight: 8 }} />
            <Text style={styles.statusBarText}>{status}</Text>
          </View>
        ) : (
          <View style={styles.toolbarButtons}>
            <TouchableOpacity
              style={[styles.syncBtn, syncing && styles.disabledBtn]}
              onPress={handleSync}
              disabled={syncing}
            >
              <Text style={styles.syncBtnText}>Sync</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearBtn} onPress={handleDeleteAll}>
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { flex: 1 },

  // Empty state
  emptyContainer: { flex: 1, backgroundColor: '#fff' },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    color: '#ddd',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyActions: {
    padding: 24,
    paddingBottom: 40,
  },
  syncBtnLarge: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  syncBtnLargeText: {
    fontSize: 17,
    color: '#fff',
    fontWeight: '600',
  },

  // Status banners
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F0F7FF',
  },
  statusBannerText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  statusBarText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },

  // Toolbar (when readings exist)
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    minHeight: 52,
  },
  toolbarButtons: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2196F3',
  },
  syncBtnText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  clearBtnText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '500',
  },

  disabledBtn: { opacity: 0.5 },
});
