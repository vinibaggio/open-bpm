# CSV Backup & Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV import so users can restore blood pressure readings from a backup file, and update the existing CSV export to include seconds for round-trip fidelity.

**Architecture:** Pure CSV parsing logic in `src/services/csv/csvImport.ts` (testable without UI), import orchestration in `SettingsScreen.tsx`. Uses `expo-document-picker` for file selection and legacy `expo-file-system` API (`readAsStringAsync`) for reading picked files.

**Tech Stack:** TypeScript, expo-document-picker, expo-file-system (legacy API), Jest

**Spec:** `docs/superpowers/specs/2026-03-18-csv-backup-import-design.md`

---

### Task 1: Install expo-document-picker

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

Run: `npx expo install expo-document-picker`

- [ ] **Step 2: Verify it installed**

Run: `cat package.json | grep expo-document-picker`
Expected: `"expo-document-picker": "~55..."`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add expo-document-picker dependency"
```

---

### Task 2: CSV parser — core happy path (TDD)

**Files:**
- Create: `src/services/csv/csvImport.ts`
- Create: `src/services/csv/__tests__/csvImport.test.ts`

- [ ] **Step 1: Write the failing test — parses valid CSV with all fields**

Create `src/services/csv/__tests__/csvImport.test.ts`:

```typescript
import { parseReadingsCsv } from '../csvImport';

describe('parseReadingsCsv', () => {
  it('parses valid CSV with all fields', () => {
    const csv = [
      'Date (YYYY-MM-DD),Time (24h HH:MM:SS),Systolic,Diastolic,HeartRate,Manual/BLE,Notes',
      '2026-03-17,14:38:42,117,70,70,ble,',
      '2026-03-18,09:15:00,125,82,72,manual,"after coffee"',
    ].join('\n');

    const result = parseReadingsCsv(csv);

    expect(result.invalidCount).toBe(0);
    expect(result.readings).toHaveLength(2);

    expect(result.readings[0]).toEqual({
      systolic: 117,
      diastolic: 70,
      heartRate: 70,
      timestamp: new Date(2026, 2, 17, 14, 38, 42).toISOString(),
      notes: null,
      source: 'ble',
    });

    expect(result.readings[1]).toEqual({
      systolic: 125,
      diastolic: 82,
      heartRate: 72,
      timestamp: new Date(2026, 2, 18, 9, 15, 0).toISOString(),
      notes: 'after coffee',
      source: 'manual',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/csv/__tests__/csvImport.test.ts -v`
Expected: FAIL — cannot find module `../csvImport`

- [ ] **Step 3: Write minimal implementation**

Create `src/services/csv/csvImport.ts`:

```typescript
import { Reading } from '../../types/reading';

export type ParsedReading = Omit<Reading, 'id'>;

export interface ParseResult {
  readings: ParsedReading[];
  invalidCount: number;
}

/**
 * Parse a single CSV field, handling RFC 4180 quoting.
 * Quoted fields: enclosed in double-quotes, internal quotes escaped as "".
 */
function parseFields(line: string): string[] {
  const fields: string[] = [];
  let i = 0;

  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      let value = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      fields.push(value);
      if (i < line.length && line[i] === ',') i++; // skip comma
    } else {
      // Unquoted field
      const commaIdx = line.indexOf(',', i);
      if (commaIdx === -1) {
        fields.push(line.substring(i));
        break;
      } else {
        fields.push(line.substring(i, commaIdx));
        i = commaIdx + 1;
        // Trailing comma → empty final field
        if (i === line.length) {
          fields.push('');
        }
      }
    }
  }

  return fields;
}

function parseRow(fields: string[]): ParsedReading | null {
  if (fields.length < 7) return null;

  const [dateStr, timeStr, sysStr, diaStr, hrStr, sourceStr, ...notesParts] = fields;

  // Parse integers
  const systolic = parseInt(sysStr, 10);
  const diastolic = parseInt(diaStr, 10);
  if (isNaN(systolic) || isNaN(diastolic)) return null;

  // Validate ranges
  if (systolic < 60 || systolic > 300) return null;
  if (diastolic < 30 || diastolic > 200) return null;
  if (diastolic >= systolic) return null;

  // Heart rate (optional)
  let heartRate: number | null = null;
  if (hrStr.trim() !== '') {
    heartRate = parseInt(hrStr, 10);
    if (isNaN(heartRate) || heartRate < 30 || heartRate > 250) return null;
  }

  // Parse timestamp — accept HH:MM or HH:MM:SS
  const timeParts = timeStr.split(':');
  if (timeParts.length < 2) return null;
  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);
  const second = timeParts.length >= 3 ? parseInt(timeParts[2], 10) : 0;

  const dateParts = dateStr.split('-');
  if (dateParts.length !== 3) return null;
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);

  const date = new Date(year, month, day, hour, minute, second);
  if (isNaN(date.getTime())) return null;

  // Source
  const sourceLower = sourceStr.trim().toLowerCase();
  const source: 'manual' | 'ble' = sourceLower === 'ble' ? 'ble' : 'manual';

  // Notes — rejoin with commas in case notes contained commas (already parsed by parseFields)
  const notesRaw = notesParts.join(',').trim();
  const notes = notesRaw === '' ? null : notesRaw;

  return {
    systolic,
    diastolic,
    heartRate,
    timestamp: date.toISOString(),
    notes,
    source,
  };
}

export function parseReadingsCsv(content: string): ParseResult {
  // Strip BOM
  const cleaned = content.replace(/^\uFEFF/, '');
  // Normalize line endings
  const lines = cleaned.replace(/\r\n/g, '\n').split('\n');

  // Need at least a header row
  if (lines.length === 0) return { readings: [], invalidCount: 0 };

  // Validate header (by column count)
  const headerFields = parseFields(lines[0]);
  if (headerFields.length < 7) return { readings: [], invalidCount: 0 };

  const readings: ParsedReading[] = [];
  let invalidCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;

    const fields = parseFields(line);
    const reading = parseRow(fields);
    if (reading) {
      readings.push(reading);
    } else {
      invalidCount++;
    }
  }

  return { readings, invalidCount };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/csv/__tests__/csvImport.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/csv/csvImport.ts src/services/csv/__tests__/csvImport.test.ts
git commit -m "feat: add CSV parser with core happy-path test"
```

---

### Task 3: CSV parser — edge cases and validation (TDD)

**Files:**
- Modify: `src/services/csv/__tests__/csvImport.test.ts`

- [ ] **Step 1: Add all remaining tests**

Append to the `describe('parseReadingsCsv')` block in `src/services/csv/__tests__/csvImport.test.ts`:

```typescript
  it('handles empty HeartRate as null', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,117,70,,ble,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings[0].heartRate).toBeNull();
  });

  it('handles quoted notes with commas and escaped quotes', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,117,70,70,manual,"took meds, felt ""dizzy"""',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings[0].notes).toBe('took meds, felt "dizzy"');
  });

  it('rejects out-of-range systolic', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,50,70,70,manual,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(0);
    expect(result.invalidCount).toBe(1);
  });

  it('rejects out-of-range diastolic', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,120,210,70,manual,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(0);
    expect(result.invalidCount).toBe(1);
  });

  it('rejects out-of-range heart rate', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,120,80,300,manual,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(0);
    expect(result.invalidCount).toBe(1);
  });

  it('rejects rows where diastolic >= systolic', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,80,90,70,manual,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(0);
    expect(result.invalidCount).toBe(1);
  });

  it('rejects unparseable dates', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      'not-a-date,14:38:00,120,80,70,manual,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(0);
    expect(result.invalidCount).toBe(1);
  });

  it('returns correct invalidCount with mixed valid and invalid rows', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,120,80,70,manual,',
      'bad-date,14:38:00,120,80,70,manual,',
      '2026-03-18,09:00:00,130,85,,ble,',
      '2026-03-19,10:00:00,50,80,70,manual,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(2);
    expect(result.invalidCount).toBe(2);
  });

  it('accepts old header format (by position)', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38,120,80,70,manual,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(1);
    // HH:MM defaults seconds to :00
    expect(result.readings[0].timestamp).toBe(
      new Date(2026, 2, 17, 14, 38, 0).toISOString()
    );
  });

  it('handles empty file gracefully', () => {
    const result = parseReadingsCsv('');
    expect(result.readings).toHaveLength(0);
    expect(result.invalidCount).toBe(0);
  });

  it('handles header-only file gracefully', () => {
    const csv = 'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes\n';
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(0);
    expect(result.invalidCount).toBe(0);
  });

  it('rejects file with insufficient columns (no valid header)', () => {
    const csv = 'Name,Value\nfoo,bar\n';
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(0);
  });

  it('strips UTF-8 BOM', () => {
    const csv = '\uFEFFDate,Time,Systolic,Diastolic,HeartRate,Source,Notes\n2026-03-17,14:38:00,120,80,70,manual,';
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(1);
  });

  it('handles \\r\\n line endings', () => {
    const csv = 'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes\r\n2026-03-17,14:38:00,120,80,70,manual,';
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(1);
  });

  it('defaults invalid source to manual', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,120,80,70,unknown,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings[0].source).toBe('manual');
  });
```

- [ ] **Step 2: Run all tests to verify they pass**

Run: `npx jest src/services/csv/__tests__/csvImport.test.ts -v`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add src/services/csv/__tests__/csvImport.test.ts
git commit -m "test: add CSV parser edge case and validation tests"
```

---

### Task 4: Update CSV export format

**Files:**
- Modify: `src/screens/SettingsScreen.tsx:74-92`

- [ ] **Step 1: Update the export header and time format**

In `src/screens/SettingsScreen.tsx`, update `handleExportCsv`:

Change the header from:
```typescript
const header = 'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes';
```
to:
```typescript
const header = 'Date (YYYY-MM-DD),Time (24h HH:MM:SS),Systolic,Diastolic,HeartRate,Manual/BLE,Notes';
```

Change the time formatting from:
```typescript
const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
```
to manual formatting for guaranteed `HH:MM:SS` output (locale-independent):
```typescript
const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: update CSV export header and include seconds in time"
```

---

### Task 5: Wire up import UI in SettingsScreen

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

**Note:** `uuid`, `react-native-get-random-values`, `ActivityIndicator`, `readingExistsByTimestamp`, and `addReading` are already available in the codebase — no new installs needed, just import them.

- [ ] **Step 1: Add imports**

At the top of `src/screens/SettingsScreen.tsx`, add:

```typescript
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { parseReadingsCsv } from '../services/csv/csvImport';
import { addReading, readingExistsByTimestamp } from '../services/database/readingRepository';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
```

Update the existing import from `readingRepository` to avoid duplicates — the current import is:
```typescript
import { getAllReadings, deleteAllReadings } from '../services/database/readingRepository';
```
Merge to:
```typescript
import { getAllReadings, deleteAllReadings, addReading, readingExistsByTimestamp } from '../services/database/readingRepository';
```

- [ ] **Step 2: Add importing state**

Add to the existing state declarations:
```typescript
const [importing, setImporting] = useState(false);
```

- [ ] **Step 3: Add handleImportCsv function**

Add after the `handleExportCsv` function:

```typescript
  async function handleImportCsv() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    setImporting(true);
    try {
      const uri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(uri);
      const { readings, invalidCount } = parseReadingsCsv(content);

      if (readings.length === 0 && invalidCount === 0) {
        Alert.alert(
          'Import Failed',
          "The file doesn't appear to be a valid readings CSV. Expected 7 columns: Date, Time, Systolic, Diastolic, HeartRate, Manual/BLE, Notes"
        );
        return;
      }

      let imported = 0;
      let duplicates = 0;
      for (const reading of readings) {
        if (await readingExistsByTimestamp(reading.timestamp)) {
          duplicates++;
          continue;
        }
        await addReading({ ...reading, id: uuidv4() });
        imported++;
      }

      Alert.alert(
        'Import Complete',
        `Imported ${imported} reading${imported !== 1 ? 's' : ''}` +
          (duplicates > 0 ? ` (${duplicates} duplicate${duplicates !== 1 ? 's' : ''} skipped)` : '') +
          (invalidCount > 0 ? ` (${invalidCount} invalid row${invalidCount !== 1 ? 's' : ''} skipped)` : '')
      );
    } catch (e: any) {
      Alert.alert('Import Error', e.message || 'Failed to import CSV.');
    } finally {
      setImporting(false);
    }
  }
```

- [ ] **Step 4: Update the JSX — rename section and add import button**

Replace the Export section:
```tsx
      {/* Export */}
      <Text style={styles.sectionHeader}>EXPORT</Text>
      <View style={styles.group}>
        <TouchableOpacity style={styles.row} onPress={handleExportAll}>
          <Text style={styles.rowTitle}>Export All Readings as PDF</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={handleExportCsv}>
          <Text style={styles.rowTitle}>Export All Readings as CSV</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>
```

With:
```tsx
      {/* Import / Export */}
      <Text style={styles.sectionHeader}>IMPORT / EXPORT</Text>
      <View style={styles.group}>
        <TouchableOpacity style={styles.row} onPress={handleImportCsv} disabled={importing}>
          <Text style={styles.rowTitle}>Import Readings from CSV</Text>
          {importing ? (
            <ActivityIndicator size="small" color="#2196F3" />
          ) : (
            <Text style={styles.chevron}>›</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={handleExportAll}>
          <Text style={styles.rowTitle}>Export All Readings as PDF</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={handleExportCsv}>
          <Text style={styles.rowTitle}>Export All Readings as CSV</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: add CSV import UI with document picker and loading state"
```

---

### Task 6: Manual verification

- [ ] **Step 1: Export a CSV from the app**

Open the app, go to Settings, tap "Export All Readings as CSV". Save the file.

- [ ] **Step 2: Verify the new export format**

Open the exported CSV. Confirm:
- Header is `Date (YYYY-MM-DD),Time (24h HH:MM:SS),Systolic,Diastolic,HeartRate,Manual/BLE,Notes`
- Time column includes seconds (e.g., `14:38:42`)

- [ ] **Step 3: Import the CSV back**

Go to Settings, tap "Import Readings from CSV", pick the exported file. Confirm:
- Alert shows "Imported 0 readings (N duplicates skipped)" (all duplicates since data already exists)

- [ ] **Step 4: Delete all readings and re-import**

Go to Settings, tap "Delete All Readings". Then import the CSV again. Confirm:
- Alert shows "Imported N readings"
- Readings list shows the restored data

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found in manual CSV import testing"
```
