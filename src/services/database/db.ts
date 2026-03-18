import * as SQLite from 'expo-sqlite';

export const READINGS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS readings (
    id TEXT PRIMARY KEY,
    systolic INTEGER NOT NULL,
    diastolic INTEGER NOT NULL,
    heartRate INTEGER,
    timestamp TEXT NOT NULL,
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'manual'
  );
  CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings(timestamp);
`;

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('bloodpressure.db');
  await db.execAsync(READINGS_SCHEMA);
  return db;
}
