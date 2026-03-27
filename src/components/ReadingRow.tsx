import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Reading } from '../types/reading';
import { classifyBP, BP_COLORS, BP_LABELS } from '../utils/bloodPressure';

interface Props {
  reading: Reading;
  onPress?: () => void;
}

export default function ReadingRow({ reading, onPress }: Props) {
  const category = classifyBP(reading.systolic, reading.diastolic);
  const color = BP_COLORS[category];
  const label = BP_LABELS[category];

  const date = new Date(reading.timestamp);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container style={styles.row} onPress={onPress} activeOpacity={0.6}>
      <View style={[styles.indicator, { backgroundColor: color }]} />
      <View style={styles.content}>
        <Text style={styles.bp}>
          {reading.systolic}/{reading.diastolic}
          {reading.heartRate ? ` · ${reading.heartRate} bpm` : ''}
        </Text>
        <Text style={styles.meta}>
          {dateStr} {timeStr} · {label} ·{' '}
          <Text style={reading.source === 'ble' ? styles.bleBadge : styles.manualBadge}>
            {reading.source === 'ble' ? 'BLE' : 'Manual'}
          </Text>
        </Text>
      </View>
    </Container>
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
  bleBadge: { color: '#2196F3', fontWeight: '600' },
  manualBadge: { color: '#888' },
});
