export interface Reading {
  id: string;
  systolic: number;
  diastolic: number;
  heartRate: number | null;
  timestamp: string; // ISO 8601
  notes: string | null;
  sourceImageUri: string | null;
}
