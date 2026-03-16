import { requireNativeModule } from 'expo-modules-core';

const ExpoSevenSegmentReaderModule = requireNativeModule('ExpoSevenSegmentReader');

export interface SevenSegmentReading {
  systolic: number;
  diastolic: number;
  heartRate?: number;
}

export async function readDisplay(imageUri: string): Promise<SevenSegmentReading> {
  return ExpoSevenSegmentReaderModule.readDisplay(imageUri);
}
