export interface Reading {
  id: string;
  systolic: number;
  diastolic: number;
  heartRate: number | null;
  timestamp: string; // ISO 8601
  notes: string | null;
  source: 'manual' | 'ble'; // how the reading was captured
  rawData: string | null; // base64-encoded raw EEPROM blocks (BLE readings only)
}
