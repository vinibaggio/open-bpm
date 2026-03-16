import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  initialSystolic?: number;
  initialDiastolic?: number;
  initialHeartRate?: number | null;
  onSave: (systolic: number, diastolic: number, heartRate: number | null, notes: string | null) => void;
  onCancel: () => void;
}

export default function ReadingForm({
  initialSystolic,
  initialDiastolic,
  initialHeartRate,
  onSave,
  onCancel,
}: Props) {
  const [systolic, setSystolic] = useState(initialSystolic?.toString() ?? '');
  const [diastolic, setDiastolic] = useState(initialDiastolic?.toString() ?? '');
  const [heartRate, setHeartRate] = useState(initialHeartRate?.toString() ?? '');
  const [notes, setNotes] = useState('');

  const canSave = systolic.length > 0 && diastolic.length > 0;

  function handleSave() {
    onSave(
      parseInt(systolic, 10),
      parseInt(diastolic, 10),
      heartRate ? parseInt(heartRate, 10) : null,
      notes || null
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Systolic (mmHg)</Text>
      <TextInput
        style={styles.input}
        value={systolic}
        onChangeText={setSystolic}
        keyboardType="number-pad"
        placeholder="120"
      />

      <Text style={styles.label}>Diastolic (mmHg)</Text>
      <TextInput
        style={styles.input}
        value={diastolic}
        onChangeText={setDiastolic}
        keyboardType="number-pad"
        placeholder="80"
      />

      <Text style={styles.label}>Heart Rate (bpm, optional)</Text>
      <TextInput
        style={styles.input}
        value={heartRate}
        onChangeText={setHeartRate}
        keyboardType="number-pad"
        placeholder="72"
      />

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. after exercise"
        multiline
      />

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.disabledBtn]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  notesInput: { height: 60, textAlignVertical: 'top' },
  buttons: { flexDirection: 'row', marginTop: 24, gap: 12 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelText: { fontSize: 16, color: '#666' },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  disabledBtn: { opacity: 0.5 },
  saveText: { fontSize: 16, color: '#fff', fontWeight: '600' },
});
