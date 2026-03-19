# CSV Backup & Import

## Goal

Allow users to back up their blood pressure readings and restore them after app deletion, reinstall, or device migration. Uses the existing CSV export format as the canonical backup format, adding a CSV import capability.

## Approach

User-driven backup/restore via CSV files. The user exports a CSV (already implemented), saves it wherever they like (iCloud Drive, Google Drive, Files, email), and imports it back when needed. No cloud service integration, no new native dependencies beyond `expo-document-picker`.

## CSV Format

Both export and import use the same format:

```
Date (YYYY-MM-DD),Time (24h HH:MM:SS),Systolic,Diastolic,HeartRate,Manual/BLE,Notes
2026-03-17,14:38:42,117,70,70,ble,
2026-03-18,09:15:00,125,82,,manual,"after coffee"
```

- Header row required on import (validated by column count, minimum 7 columns)
- Columns matched by position, not header text (old `Source` header imports fine)
- `Date`: `YYYY-MM-DD`
- `Time`: `HH:MM:SS` 24-hour format (seconds included for round-trip fidelity)
- `Date + Time` combined into ISO 8601 timestamp for storage
- `Systolic`: required integer
- `Diastolic`: required integer
- `HeartRate`: optional integer, empty string → `null`
- `Manual/BLE`: `manual` or `ble`, defaults to `manual` if missing/invalid
- `Notes`: RFC 4180 quoting (double-quotes, `""` for escaped quotes)
- Timestamps are in the device's local timezone. Cross-timezone migration may shift reading times.

**Breaking change to export:** The existing CSV export header changes from `Date,Time,Systolic,Diastolic,HeartRate,Source,Notes` to the new self-documenting header. Time column now includes seconds. Import accepts both old (`HH:MM`) and new (`HH:MM:SS`) time formats — missing seconds default to `:00`.

## Import Flow

1. User taps "Import Readings from CSV" in Settings
2. `expo-document-picker` opens with broad type filter (`text/csv`, `text/comma-separated-values`, `text/*`) to handle platform MIME type differences
3. App reads file content via `FileSystem.readAsStringAsync(uri)` from the legacy expo-file-system API (the Next `File` API doesn't accept arbitrary URIs from the document picker)
4. Strip UTF-8 BOM if present, normalize `\r\n` to `\n`
5. `parseReadingsCsv(content)` parses and validates each row
6. Show loading spinner during import
7. For each valid row: skip if timestamp already exists (`readingExistsByTimestamp`), otherwise insert (`addReading`)
8. Show summary alert: "Imported X readings (Y duplicates skipped, Z invalid rows skipped)"
9. On bad format: "Import Failed — the file doesn't appear to be a valid readings CSV. Expected 7 columns: Date, Time, Systolic, Diastolic, HeartRate, Manual/BLE, Notes"

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
- Loading spinner shown during import (reuse existing `scanning`/`loading` pattern)
- Existing CSV export updated to use new header format and include seconds in time

## Architecture

### New Files

- `src/services/csv/csvImport.ts` — CSV parsing and validation (pure functions)
- `src/services/csv/__tests__/csvImport.test.ts` — unit tests

### Modified Files

- `src/screens/SettingsScreen.tsx` — add import button, rename section, update export header/time format, wire up document picker
- `package.json` — add `expo-document-picker` dependency

### csvImport.ts Exports

```typescript
type ParsedReading = Omit<Reading, 'id'>;

interface ParseResult {
  readings: ParsedReading[];
  invalidCount: number;
}

function parseReadingsCsv(content: string): ParseResult;
```

`ParsedReading` is `Omit<Reading, 'id'>` — the orchestration layer assigns `id` via `uuidv4()` before inserting.

### Import Orchestration (SettingsScreen)

```
handleImportCsv:
  1. DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/*'] })
  2. Read file via FileSystem.readAsStringAsync(uri)
  3. Strip BOM, normalize line endings
  4. parseReadingsCsv(content)
  5. Show loading state
  6. Loop: readingExistsByTimestamp → addReading (with uuidv4 for id)
  7. Alert with summary
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
- Accepts both old and new header/time formats (by position; `HH:MM` defaults seconds to `:00`)
- Handles empty file / header-only file gracefully (returns 0 readings)
- Rejects file with no header (insufficient columns on first row)
- Strips UTF-8 BOM
- Handles `\r\n` line endings

No integration tests needed — import orchestration is glue code over already-tested DB functions.
