import { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { addReading } from '../services/database/readingRepository';
import { Reading } from '../types/reading';
import ReadingForm from '../components/ReadingForm';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export default function CaptureScreen() {
  const [key, setKey] = useState(0);

  async function handleSave(
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
    Alert.alert('Saved', `${systolic}/${diastolic} recorded.`);
    setKey((k) => k + 1); // reset form
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manual Entry</Text>
        <Text style={styles.subtitle}>
          Enter your blood pressure reading manually.
        </Text>
      </View>
      <ReadingForm
        key={key}
        onSave={handleSave}
        onCancel={() => setKey((k) => k + 1)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 20, paddingTop: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#333' },
  subtitle: { fontSize: 14, color: '#999', marginTop: 4 },
});
