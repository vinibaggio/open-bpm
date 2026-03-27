import { Modal, View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import ReadingForm from './ReadingForm';
import { Reading } from '../types/reading';

interface Props {
  reading: Reading | null;
  visible: boolean;
  onSave: (reading: Reading) => void;
  onClose: () => void;
}

export default function EditReadingSheet({ reading, visible, onSave, onClose }: Props) {
  if (!reading) return null;

  function handleSave(
    systolic: number,
    diastolic: number,
    heartRate: number | null,
    notes: string | null,
    timestamp: Date
  ) {
    onSave({
      ...reading!,
      systolic,
      diastolic,
      heartRate,
      notes,
      timestamp: timestamp.toISOString(),
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Edit Reading</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeBtn}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.formContainer}>
          <ReadingForm
            initialSystolic={reading.systolic}
            initialDiastolic={reading.diastolic}
            initialHeartRate={reading.heartRate}
            initialNotes={reading.notes}
            initialTimestamp={reading.timestamp}
            showTimestamp
            onSave={handleSave}
            onCancel={onClose}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#333' },
  closeBtn: { fontSize: 16, color: '#2196F3' },
  formContainer: { flex: 1 },
});
