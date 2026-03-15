import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { createOCRService } from '../services/ocr/ocrService';
import { parseBPFromText, ParsedBP } from '../services/ocr/bpParser';
import { addReading } from '../services/database/readingRepository';
import { Reading } from '../types/reading';
import ReadingForm from '../components/ReadingForm';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

type Screen = 'camera' | 'form';

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [screen, setScreen] = useState<Screen>('camera');
  const [parsed, setParsed] = useState<ParsedBP | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permText}>Camera permission is needed to capture readings.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function handleCapture() {
    if (!cameraRef.current) return;
    setProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (!photo) return;
      setImageUri(photo.uri);

      const ocr = createOCRService();
      const result = await ocr.recognizeText(photo.uri);
      const bp = parseBPFromText(result.rawText);
      setParsed(bp);
      setScreen('form');
    } catch (e) {
      Alert.alert('OCR Error', 'Could not extract text. You can enter values manually.');
      setParsed(null);
      setScreen('form');
    } finally {
      setProcessing(false);
    }
  }

  function handleManualEntry() {
    setParsed(null);
    setImageUri(null);
    setScreen('form');
  }

  async function handleSave(systolic: number, diastolic: number, heartRate: number | null, notes: string | null) {
    const reading: Reading = {
      id: uuidv4(),
      systolic,
      diastolic,
      heartRate,
      timestamp: new Date().toISOString(),
      notes,
      sourceImageUri: imageUri,
    };
    await addReading(reading);
    Alert.alert('Saved', `${systolic}/${diastolic} recorded.`);
    setScreen('camera');
    setParsed(null);
    setImageUri(null);
  }

  function handleCancel() {
    setScreen('camera');
    setParsed(null);
    setImageUri(null);
  }

  if (screen === 'form') {
    return (
      <ScrollView style={styles.formContainer}>
        <ReadingForm
          initialSystolic={parsed?.systolic}
          initialDiastolic={parsed?.diastolic}
          initialHeartRate={parsed?.heartRate}
          imageUri={imageUri}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </ScrollView>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <View style={styles.controls}>
        <TouchableOpacity style={styles.manualBtn} onPress={handleManualEntry}>
          <Text style={styles.manualText}>Manual Entry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.captureBtn, processing && styles.disabledBtn]}
          onPress={handleCapture}
          disabled={processing}
        >
          <View style={styles.captureInner} />
        </TouchableOpacity>
        <View style={{ width: 80 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
  },
  disabledBtn: { opacity: 0.5 },
  manualBtn: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  manualText: { color: '#fff', fontWeight: '600' },
  formContainer: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  permText: { fontSize: 16, textAlign: 'center', marginBottom: 16 },
  permBtn: { backgroundColor: '#2196F3', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
