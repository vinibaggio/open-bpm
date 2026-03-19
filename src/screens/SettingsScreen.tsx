import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { getSavedDevice, saveDevice, forgetDevice, SavedDevice } from '../services/device/deviceStorage';
import { scanForOmron } from '../services/ble/bleSync';
import { getAllReadings, deleteAllReadings, addReading, readingExistsByTimestamp } from '../services/database/readingRepository';
import { generateReportHtml } from '../services/report/reportHtml';
import { parseReadingsCsv } from '../services/csv/csvImport';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export default function SettingsScreen() {
  const [device, setDevice] = useState<SavedDevice | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getSavedDevice().then((d) => {
        setDevice(d);
        setLoading(false);
      });
    }, [])
  );

  async function handleScan() {
    setScanning(true);
    try {
      const found = await scanForOmron();
      const name = found.name || found.localName || 'Omron Monitor';
      await saveDevice(found.id, name);
      setDevice({ id: found.id, name, lastSyncDate: null });
      Alert.alert('Device Saved', `${name} has been saved.`);
    } catch (e: any) {
      Alert.alert('Scan Failed', e.message || 'Could not find a device.');
    } finally {
      setScanning(false);
    }
  }

  async function handleForget() {
    Alert.alert('Forget Device', 'Remove this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget',
        style: 'destructive',
        onPress: async () => {
          await forgetDevice();
          setDevice(null);
        },
      },
    ]);
  }

  async function handleExportAll() {
    const readings = await getAllReadings();
    if (readings.length === 0) {
      Alert.alert('No Data', 'No readings to export.');
      return;
    }
    const html = generateReportHtml(readings, 'All Time', 'Present');
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  }

  async function handleExportCsv() {
    const readings = await getAllReadings();
    if (readings.length === 0) {
      Alert.alert('No Data', 'No readings to export.');
      return;
    }
    const header = 'Date (YYYY-MM-DD),Time (24h HH:MM:SS),Systolic,Diastolic,HeartRate,Manual/BLE,Notes';
    const rows = readings.map(r => {
      const d = new Date(r.timestamp);
      const date = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      const notes = r.notes ? `"${r.notes.replace(/"/g, '""')}"` : '';
      return `${date},${time},${r.systolic},${r.diastolic},${r.heartRate ?? ''},${r.source},${notes}`;
    });
    const csv = [header, ...rows].join('\n');
    const file = new File(Paths.cache, 'readings.csv');
    file.write(csv);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
  }

  async function handleImportCsv() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    setImporting(true);
    try {
      const uri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(uri);
      const { readings, invalidCount } = parseReadingsCsv(content);

      if (readings.length === 0 && invalidCount === 0) {
        Alert.alert(
          'Import Failed',
          "The file doesn't appear to be a valid readings CSV. Expected 7 columns: Date, Time, Systolic, Diastolic, HeartRate, Manual/BLE, Notes"
        );
        return;
      }

      let imported = 0;
      let duplicates = 0;
      for (const reading of readings) {
        if (await readingExistsByTimestamp(reading.timestamp)) {
          duplicates++;
          continue;
        }
        await addReading({ ...reading, id: uuidv4() });
        imported++;
      }

      Alert.alert(
        'Import Complete',
        `Imported ${imported} reading${imported !== 1 ? 's' : ''}` +
          (duplicates > 0 ? ` (${duplicates} duplicate${duplicates !== 1 ? 's' : ''} skipped)` : '') +
          (invalidCount > 0 ? ` (${invalidCount} invalid row${invalidCount !== 1 ? 's' : ''} skipped)` : '')
      );
    } catch (e: any) {
      Alert.alert('Import Error', e.message || 'Failed to import CSV.');
    } finally {
      setImporting(false);
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
            Alert.alert('Done', 'All readings have been deleted.');
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

  return (
    <ScrollView style={styles.container}>
      {/* Bluetooth Monitor */}
      <Text style={styles.sectionHeader}>BLUETOOTH MONITOR</Text>
      <View style={styles.group}>
        {device ? (
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>{device.name}</Text>
              <Text style={styles.rowSubtitle}>
                Saved{device.lastSyncDate
                  ? ` · Last synced ${new Date(device.lastSyncDate).toLocaleDateString()}`
                  : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={handleForget}>
              <Text style={styles.forgetText}>Forget</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.row, device && styles.rowBorder]}
          onPress={handleScan}
          disabled={scanning}
        >
          <Text style={styles.linkText}>
            {scanning ? 'Scanning...' : 'Scan for Device'}
          </Text>
          {scanning ? (
            <ActivityIndicator size="small" color="#2196F3" />
          ) : (
            <Text style={styles.chevron}>›</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Import / Export */}
      <Text style={styles.sectionHeader}>IMPORT / EXPORT</Text>
      <View style={styles.group}>
        <TouchableOpacity style={styles.row} onPress={handleImportCsv} disabled={importing}>
          <Text style={styles.rowTitle}>Import Readings from CSV</Text>
          {importing ? (
            <ActivityIndicator size="small" color="#2196F3" />
          ) : (
            <Text style={styles.chevron}>›</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={handleExportAll}>
          <Text style={styles.rowTitle}>Export All Readings as PDF</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={handleExportCsv}>
          <Text style={styles.rowTitle}>Export All Readings as CSV</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Data */}
      <Text style={styles.sectionHeader}>DATA</Text>
      <View style={styles.group}>
        <TouchableOpacity style={styles.row} onPress={handleDeleteAll}>
          <Text style={styles.destructiveText}>Delete All Readings</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.footer}>
        This will permanently remove all saved readings. This cannot be undone.
      </Text>

      {/* About */}
      <Text style={styles.sectionHeader}>ABOUT</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <Text style={styles.rowTitle}>Version</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.5,
  },
  group: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 16, color: '#333' },
  rowSubtitle: { fontSize: 13, color: '#4CAF50', marginTop: 2 },
  rowValue: { fontSize: 16, color: '#999' },
  chevron: { fontSize: 20, color: '#ccc' },
  linkText: { fontSize: 16, color: '#2196F3' },
  forgetText: { fontSize: 14, color: '#F44336' },
  destructiveText: { fontSize: 16, color: '#F44336' },
  footer: { paddingHorizontal: 16, paddingTop: 8, fontSize: 12, color: '#999', lineHeight: 18 },
});
