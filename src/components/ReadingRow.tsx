import { View, Text, StyleSheet } from 'react-native';
import { Reading } from '../types/reading';
import { classifyBP, BP_COLORS, BP_LABELS } from '../utils/bloodPressure';

interface Props {
  reading: Reading;
}

export default function ReadingRow({ reading }: Props) {
  const category = classifyBP(reading.systolic, reading.diastolic);
  const color = BP_COLORS[category];
  const label = BP_LABELS[category];

  const date = new Date(reading.timestamp);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.row}>
      <View style={[styles.indicator, { backgroundColor: color }]} />
      <View style={styles.content}>
        <Text style={styles.bp}>
          {reading.systolic}/{reading.diastolic}
          {reading.heartRate ? ` · ${reading.heartRate} bpm` : ''}
        </Text>
        <Text style={styles.meta}>
          {dateStr} {timeStr} · {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  content: { flex: 1 },
  bp: { fontSize: 18, fontWeight: '600' },
  meta: { fontSize: 13, color: '#888', marginTop: 2 },
});
