import { getDatabase } from './db';
import { Reading } from '../../types/reading';

export async function addReading(reading: Reading): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO readings (id, systolic, diastolic, heartRate, timestamp, notes, sourceImageUri) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [reading.id, reading.systolic, reading.diastolic, reading.heartRate, reading.timestamp, reading.notes, reading.sourceImageUri]
  );
}

export async function getAllReadings(): Promise<Reading[]> {
  const db = await getDatabase();
  return db.getAllAsync<Reading>('SELECT * FROM readings ORDER BY timestamp DESC');
}

export async function getReadingsByDateRange(startDate: string, endDate: string): Promise<Reading[]> {
  const db = await getDatabase();
  return db.getAllAsync<Reading>(
    'SELECT * FROM readings WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
    [startDate, endDate]
  );
}

export async function readingExistsByTimestamp(timestamp: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM readings WHERE timestamp = ?',
    [timestamp]
  );
  return (result?.count ?? 0) > 0;
}

export async function deleteReading(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM readings WHERE id = ?', [id]);
}
