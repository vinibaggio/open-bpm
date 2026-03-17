import { Modal, View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import ReadingForm from './ReadingForm';

interface Props {
  visible: boolean;
  onSave: (systolic: number, diastolic: number, heartRate: number | null, notes: string | null) => void;
  onClose: () => void;
}

export default function ManualEntrySheet({ visible, onSave, onClose }: Props) {
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
          <Text style={styles.title}>Manual Entry</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeBtn}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.formContainer}>
          <ReadingForm
            onSave={onSave}
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
