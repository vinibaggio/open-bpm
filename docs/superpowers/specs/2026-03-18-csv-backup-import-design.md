# CSV Backup & Import

## Goal

Allow users to back up their blood pressure readings and restore them after app deletion, reinstall, or device migration. Uses the existing CSV export format as the canonical backup format, adding a CSV import capability.

## Approach

User-driven backup/restore via CSV files. The user exports a CSV (already implemented), saves it wherever they like (iCloud Drive, Google Drive, Files, email), and imports it back when needed. No cloud service integration, no new native dependencies beyond `expo-document-picker`.

## CSV Format

Both export and import use the same format:

```
Date (YYYY-MM-DD),Time (24h),Systolic,Diastolic,HeartRate,Manual/BLE,Notes
2026-03-17,14:38,117,70,70,ble,
2026-03-18,09:15,125,82,,manual,"after coffee"
```

- Header row required on import (validated by column count)
- Columns matched by position, not header text (old `Source` header imports fine)
- `Date`: `YYYY-MM-DD`
- `Time`: `HH:MM` 24-hour format
- `Date + Time` combined into ISO 8601 timestamp for storage
- `Systolic`: required integer
- `Diastolic`: required integer
- `HeartRate`: optional integer, empty string → `null`
- `Manual/BLE`: `manual` or `ble`, defaults to `manual` if missing/invalid
- `Notes`: RFC 4180 quoting (double-quotes, `""` for escaped quotes)

**Breaking change to export:** The existing CSV export header changes from `Date,Time,Systolic,Diastolic,HeartRate,Source,Notes` to `Date (YYYY-MM-DD),Time (24h),Systolic,Diastolic,HeartRate,Manual/BLE,Notes`. Import accepts both.

## Import Flow

1. User taps "Import Readings from CSV" in Settings
2. `expo-document-picker` opens — user picks a `.csv` file
3. App reads file content via `expo-file-system`
4. `parseReadingsCsv(content)` parses and validates each row
5. For each valid row: skip if timestamp already exists (`readingExistsByTimestamp`), otherwise insert (`addReading`)
6. Show summary alert: "Imported X readings (Y duplicates skipped, Z invalid rows skipped)"
7. On bad format: "Import Failed — the file doesn't appear to be a valid readings CSV."

### Row Validation

- Systolic: integer 60–300
- Diastolic: integer 30–200
- HeartRate: integer 30–250 if present
- Date + Time: must parse to a valid date
- Diastolic < Systolic
- Invalid rows are counted and reported, not fatal

## UI Changes

- SettingsScreen section header renamed from `EXPORT` to `IMPORT / EXPORT`
- New button "Import Readings from CSV" added above existing export buttons
- Existing CSV export updated to use new header format

## Architecture

### New Files

- `src/services/csv/csvImport.ts` — CSV parsing and validation (pure functions)
- `src/services/csv/__tests__/csvImport.test.ts` — unit tests

### Modified Files

- `src/screens/SettingsScreen.tsx` — add import button, rename section, update export header, wire up document picker
- `package.json` — add `expo-document-picker` dependency

### csvImport.ts Exports

```typescript
interface ParsedReading {
  systolic: number;
  diastolic: number;
  heartRate: number | null;
  timestamp: string; // ISO 8601
  notes: string | null;
  source: 'manual' | 'ble';
}

interface ParseResult {
  readings: ParsedReading[];
  invalidCount: number;
}

function parseReadingsCsv(content: string): ParseResult;
```

### Import Orchestration (SettingsScreen)

```
handleImportCsv:
  1. DocumentPicker.getDocumentAsync({ type: 'text/csv' })
  2. Read file via expo-file-system
  3. parseReadingsCsv(content)
  4. Loop: readingExistsByTimestamp → addReading (with uuidv4 for id)
  5. Alert with summary
```

## New Dependency

- `expo-document-picker` (~55.x) — Expo SDK 55 compatible, has config plugin for managed workflow

## Testing

### Unit Tests (csvImport.test.ts)

- Parses valid CSV with all fields
- Handles empty HeartRate → `null`
- Handles quoted Notes with commas and escaped quotes
- Rejects out-of-range systolic, diastolic, heart rate
- Rejects rows where diastolic >= systolic
- Rejects unparseable dates
- Returns correct `invalidCount`
- Accepts both old and new header formats (by position)
- Handles empty file / header-only file
- Handles file with no header

No integration tests needed — import orchestration is glue code over already-tested DB functions.
