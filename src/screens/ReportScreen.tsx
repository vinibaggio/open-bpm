import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getReadingsByDateRange } from '../services/database/readingRepository';
import { generateReportHtml } from '../services/report/reportHtml';
import { Reading } from '../types/reading';
import ReadingRow from '../components/ReadingRow';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function thirtyDaysAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

export default function ReportScreen() {
  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadReadings();
    }, [startDate, endDate])
  );

  async function loadReadings() {
    const data = await getReadingsByDateRange(
      `${startDate}T00:00:00Z`,
      `${endDate}T23:59:59Z`
    );
    setReadings(data);
    setLoaded(true);
  }

  async function handleExportPdf() {
    if (readings.length === 0) {
      Alert.alert('No Data', 'No readings in the selected date range.');
      return;
    }
    const html = generateReportHtml(readings, startDate, endDate);
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  }

  return (
    <View style={styles.container}>
      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <Text style={styles.dateLabel}>From</Text>
          <TextInput
            style={styles.dateInput}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
          />
        </View>
        <View style={styles.dateField}>
          <Text style={styles.dateLabel}>To</Text>
          <TextInput
            style={styles.dateInput}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
          />
        </View>
      </View>

      <TouchableOpacity style={styles.loadBtn} onPress={loadReadings}>
        <Text style={styles.loadBtnText}>Load Readings</Text>
      </TouchableOpacity>

      {loaded && readings.length === 0 && (
        <Text style={styles.noData}>No readings in this date range.</Text>
      )}

      <ScrollView style={styles.preview}>
        {readings.map((r) => (
          <ReadingRow key={r.id} reading={r} />
        ))}
      </ScrollView>

      {readings.length > 0 && (
        <TouchableOpacity style={styles.exportBtn} onPress={handleExportPdf}>
          <Text style={styles.exportBtnText}>Export PDF</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  dateRow: { flexDirection: 'row', padding: 16, gap: 12 },
  dateField: { flex: 1 },
  dateLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 4 },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  loadBtn: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  loadBtnText: { fontSize: 15, fontWeight: '600', color: '#333' },
  noData: { textAlign: 'center', color: '#999', marginTop: 32, fontSize: 15 },
  preview: { flex: 1, marginTop: 8 },
  exportBtn: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  exportBtnText: { fontSize: 16, color: '#fff', fontWeight: '600' },
});
