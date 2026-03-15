import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('bloodpressure.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY,
      systolic INTEGER NOT NULL,
      diastolic INTEGER NOT NULL,
      heartRate INTEGER,
      timestamp TEXT NOT NULL,
      notes TEXT,
      sourceImageUri TEXT
    );
  `);
  return db;
}
