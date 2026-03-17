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
import {
  getAllReadings,
  deleteReading,
} from '../services/database/readingRepository';
import ReadingRow from '../components/ReadingRow';
import SwipeableRow from '../components/SwipeableRow';
import ManualEntrySheet from '../components/ManualEntrySheet';
import { scanForOmron, syncReadings } from '../services/ble/bleSync';
import { addReading } from '../services/database/readingRepository';
import { getSavedDevice, updateLastSyncDate, SavedDevice } from '../services/device/deviceStorage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/TabNavigator';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export default function ReadingListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [savedDevice, setSavedDevice] = useState<SavedDevice | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    const [data, device] = await Promise.all([
      getAllReadings(),
      getSavedDevice(),
    ]);
    setReadings(data);
    setSavedDevice(device);
    setLoading(false);
  }

  async function handleSync() {
    setSyncing(true);
    setStatus('Scanning...');
    try {
      const device = await scanForOmron(setStatus);
      const imported = await syncReadings(device, setStatus);
      if (imported > 0) {
        await updateLastSyncDate();
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

  async function handleDeleteReading(id: string) {
    Alert.alert(
      'Delete Reading',
      'Are you sure you want to delete this reading?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteReading(id);
            setReadings((prev) => prev.filter((r) => r.id !== id));
          },
        },
      ]
    );
  }

  async function handleManualSave(
    systolic: number,
    diastolic: number,
    heartRate: number | null,
    notes: string | null
  ) {
    const reading: Reading = {
      id: uuidv4(),
      systolic,
      diastolic,
      heartRate,
      timestamp: new Date().toISOString(),
      notes,
      source: 'manual',
    };
    await addReading(reading);
    setShowManualEntry(false);
    const updated = await getAllReadings();
    setReadings(updated);
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
          <Text style={styles.emptyTitle}>No readings yet</Text>
          <Text style={styles.emptyHint}>
            Take a reading on your Omron monitor, then sync it here, or add one manually.
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
            style={[styles.actionBtn, syncing && styles.disabledBtn]}
            onPress={savedDevice ? handleSync : () => navigation.navigate('Settings')}
            disabled={syncing}
          >
            <Text style={styles.actionBtnText}>
              {savedDevice ? 'Sync from Monitor' : 'Set Up Monitor'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.secondaryBtn]}
            onPress={() => setShowManualEntry(true)}
          >
            <Text style={[styles.actionBtnText, styles.secondaryBtnText]}>Add Manually</Text>
          </TouchableOpacity>
        </View>
        <ManualEntrySheet
          visible={showManualEntry}
          onSave={handleManualSave}
          onClose={() => setShowManualEntry(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sync banner — only when device is configured */}
      {savedDevice && (
        <View style={styles.syncBanner}>
          {status ? (
            <View style={styles.syncBannerStatus}>
              <ActivityIndicator size="small" color="#1565C0" style={{ marginRight: 8 }} />
              <Text style={styles.syncBannerStatusText}>{status}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.syncBannerDevice}>{savedDevice.name}</Text>
              <TouchableOpacity
                style={[styles.syncBannerBtn, syncing && styles.disabledBtn]}
                onPress={handleSync}
                disabled={syncing}
              >
                <Text style={styles.syncBannerBtnText}>Sync</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <FlatList
        data={readings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SwipeableRow onDelete={() => handleDeleteReading(item.id)}>
            <ReadingRow reading={item} />
          </SwipeableRow>
        )}
        style={styles.list}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowManualEntry(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <ManualEntrySheet
        visible={showManualEntry}
        onSave={handleManualSave}
        onClose={() => setShowManualEntry(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { flex: 1 },

  // Sync banner
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#E3F2FD',
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
  },
  syncBannerDevice: { fontSize: 13, color: '#1565C0' },
  syncBannerBtn: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
  },
  syncBannerBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  syncBannerStatus: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  syncBannerStatusText: { fontSize: 13, color: '#1565C0' },

  // Empty state
  emptyContainer: { flex: 1, backgroundColor: '#fff' },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
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
    gap: 12,
  },
  actionBtn: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 17,
    color: '#fff',
    fontWeight: '600',
  },
  secondaryBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  secondaryBtnText: {
    color: '#2196F3',
  },

  // Status
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

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 30 },

  disabledBtn: { opacity: 0.5 },
});
