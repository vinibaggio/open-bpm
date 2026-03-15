# Blood Pressure Tracker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an iOS blood pressure tracking app that extracts readings from photos of BP monitors via OCR, stores them locally, and generates printable PDF reports with abnormal values highlighted.

**Architecture:** React Native (Expo) app with three tab screens (Reading List, Capture, Report). OCR via `expo-text-extractor` (Apple Vision on iOS, Google ML Kit on Android). Local SQLite storage. PDF reports generated from HTML via `expo-print`.

**Tech Stack:** React Native, Expo SDK 55+, TypeScript, expo-sqlite, expo-camera, expo-text-extractor, expo-print, expo-sharing

**Spec:** `docs/superpowers/specs/2026-03-14-bloodpressure-app-design.md`

---

## File Structure

```
src/
  types/
    reading.ts              # Reading type definition
  services/
    ocr/
      types.ts              # OCRService interface, OCRResult type
      ocrService.ts         # Factory: returns platform OCR implementation
      bpParser.ts           # Parses raw OCR text → systolic/diastolic/heartRate
    database/
      db.ts                 # SQLite initialization and migrations
      readingRepository.ts  # CRUD operations for readings
    report/
      reportHtml.ts         # Generates HTML table from readings
  utils/
    bloodPressure.ts        # BP category classification + colors
  screens/
    ReadingListScreen.tsx   # Home tab: chronological list of readings
    CaptureScreen.tsx       # Center tab: camera + OCR + confirmation form
    ReportScreen.tsx        # Report tab: date range picker + PDF export
  components/
    ReadingRow.tsx          # Single reading row with colored indicator
    ReadingForm.tsx         # Form for confirming/editing/manual-entering readings
  navigation/
    TabNavigator.tsx        # Bottom tab bar with 3 tabs
App.tsx                     # Entry point, wraps TabNavigator
```

---

## Chunk 1: Foundation

### Task 1: Project Scaffolding

**Files:**
- Create: project root (Expo init)
- Create: `tsconfig.json` (auto-generated)

- [ ] **Step 1: Initialize Expo project**

```bash
npx create-expo-app@latest bloodpressure-app --template blank-typescript
```

Move the generated files into the current directory (or init in place).

- [ ] **Step 2: Install dependencies**

```bash
npx expo install expo-sqlite expo-camera expo-sharing expo-print expo-text-extractor
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native @types/jest ts-jest
```

- [ ] **Step 4: Configure Jest in package.json**

Add to `package.json`:
```json
{
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"
    ]
  }
}
```

- [ ] **Step 5: Verify project runs**

```bash
npx expo start --ios
```

Expected: blank app opens in iOS simulator.

- [ ] **Step 6: Create src directory structure**

```bash
mkdir -p src/{types,services/{ocr,database,report},utils,screens,components,navigation}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize Expo project with dependencies"
```

---

### Task 2: Reading Type & BP Classification Utility

**Files:**
- Create: `src/types/reading.ts`
- Create: `src/utils/bloodPressure.ts`
- Create: `src/utils/__tests__/bloodPressure.test.ts`

- [ ] **Step 1: Create Reading type**

Create `src/types/reading.ts`:
```typescript
export interface Reading {
  id: string;
  systolic: number;
  diastolic: number;
  heartRate: number | null;
  timestamp: string; // ISO 8601
  notes: string | null;
  sourceImageUri: string | null;
}
```

- [ ] **Step 2: Write failing tests for BP classification**

Create `src/utils/__tests__/bloodPressure.test.ts`:
```typescript
import { classifyBP, BPCategory } from '../bloodPressure';

describe('classifyBP', () => {
  it('classifies normal BP', () => {
    expect(classifyBP(110, 70)).toBe(BPCategory.Normal);
  });

  it('classifies elevated BP', () => {
    expect(classifyBP(125, 75)).toBe(BPCategory.Elevated);
  });

  it('classifies elevated requires diastolic < 80', () => {
    expect(classifyBP(125, 82)).toBe(BPCategory.HighStage1);
  });

  it('classifies high stage 1 by systolic', () => {
    expect(classifyBP(135, 75)).toBe(BPCategory.HighStage1);
  });

  it('classifies high stage 1 by diastolic', () => {
    expect(classifyBP(115, 85)).toBe(BPCategory.HighStage1);
  });

  it('classifies high stage 2 by systolic', () => {
    expect(classifyBP(145, 75)).toBe(BPCategory.HighStage2);
  });

  it('classifies high stage 2 by diastolic', () => {
    expect(classifyBP(115, 95)).toBe(BPCategory.HighStage2);
  });

  it('classifies crisis by systolic', () => {
    expect(classifyBP(185, 75)).toBe(BPCategory.Crisis);
  });

  it('classifies crisis by diastolic', () => {
    expect(classifyBP(115, 125)).toBe(BPCategory.Crisis);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx jest src/utils/__tests__/bloodPressure.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement BP classification**

Create `src/utils/bloodPressure.ts`:
```typescript
export enum BPCategory {
  Normal = 'normal',
  Elevated = 'elevated',
  HighStage1 = 'highStage1',
  HighStage2 = 'highStage2',
  Crisis = 'crisis',
}

export function classifyBP(systolic: number, diastolic: number): BPCategory {
  if (systolic > 180 || diastolic > 120) return BPCategory.Crisis;
  if (systolic >= 140 || diastolic >= 90) return BPCategory.HighStage2;
  if (systolic >= 130 || diastolic >= 80) return BPCategory.HighStage1;
  if (systolic >= 120 && diastolic < 80) return BPCategory.Elevated;
  return BPCategory.Normal;
}

export const BP_COLORS: Record<BPCategory, string> = {
  [BPCategory.Normal]: '#4CAF50',    // green
  [BPCategory.Elevated]: '#FFC107',  // yellow
  [BPCategory.HighStage1]: '#FF9800', // orange
  [BPCategory.HighStage2]: '#F44336', // red
  [BPCategory.Crisis]: '#B71C1C',    // dark red
};

export const BP_LABELS: Record<BPCategory, string> = {
  [BPCategory.Normal]: 'Normal',
  [BPCategory.Elevated]: 'Elevated',
  [BPCategory.HighStage1]: 'High (Stage 1)',
  [BPCategory.HighStage2]: 'High (Stage 2)',
  [BPCategory.Crisis]: 'Crisis',
};
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest src/utils/__tests__/bloodPressure.test.ts
```

Expected: all 9 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/reading.ts src/utils/bloodPressure.ts src/utils/__tests__/bloodPressure.test.ts
git commit -m "feat: add Reading type and BP classification utility"
```

---

### Task 3: OCR Service Interface & BP Parser

**Files:**
- Create: `src/services/ocr/types.ts`
- Create: `src/services/ocr/ocrService.ts`
- Create: `src/services/ocr/bpParser.ts`
- Create: `src/services/ocr/__tests__/bpParser.test.ts`

- [ ] **Step 1: Create OCR types**

Create `src/services/ocr/types.ts`:
```typescript
export interface OCRResult {
  rawText: string[];
  confidence: number;
}

export interface OCRService {
  recognizeText(imageUri: string): Promise<OCRResult>;
}
```

- [ ] **Step 2: Create OCR service factory**

Create `src/services/ocr/ocrService.ts`:
```typescript
import { OCRService } from './types';
import ExpoTextExtractor from 'expo-text-extractor';

class ExpoOCRService implements OCRService {
  async recognizeText(imageUri: string) {
    const result = await ExpoTextExtractor.extractText(imageUri);
    return {
      rawText: result.map((block: { text: string }) => block.text),
      confidence: 1, // expo-text-extractor doesn't expose confidence
    };
  }
}

export function createOCRService(): OCRService {
  return new ExpoOCRService();
}
```

- [ ] **Step 3: Write failing tests for BP parser**

Create `src/services/ocr/__tests__/bpParser.test.ts`:
```typescript
import { parseBPFromText } from '../bpParser';

describe('parseBPFromText', () => {
  it('extracts three numbers as systolic, diastolic, heartRate', () => {
    const result = parseBPFromText(['120', '80', '72']);
    expect(result).toEqual({ systolic: 120, diastolic: 80, heartRate: 72 });
  });

  it('extracts two numbers as systolic, diastolic', () => {
    const result = parseBPFromText(['130', '85']);
    expect(result).toEqual({ systolic: 130, diastolic: 85, heartRate: null });
  });

  it('extracts numbers from mixed text', () => {
    const result = parseBPFromText(['SYS 120', 'DIA 80', 'PUL 72']);
    expect(result).toEqual({ systolic: 120, diastolic: 80, heartRate: 72 });
  });

  it('extracts numbers from a single string with slashes', () => {
    const result = parseBPFromText(['120/80']);
    expect(result).toEqual({ systolic: 120, diastolic: 80, heartRate: null });
  });

  it('returns null when fewer than 2 numbers found', () => {
    const result = parseBPFromText(['hello']);
    expect(result).toBeNull();
  });

  it('filters out unreasonable BP values', () => {
    // Year "2026" should not be treated as BP
    const result = parseBPFromText(['2026', '120', '80', '72']);
    expect(result).toEqual({ systolic: 120, diastolic: 80, heartRate: 72 });
  });

  it('handles numbers embedded in longer text', () => {
    const result = parseBPFromText(['Blood Pressure: 135/88 Pulse: 65']);
    expect(result).toEqual({ systolic: 135, diastolic: 88, heartRate: 65 });
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
npx jest src/services/ocr/__tests__/bpParser.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Implement BP parser**

Create `src/services/ocr/bpParser.ts`:
```typescript
export interface ParsedBP {
  systolic: number;
  diastolic: number;
  heartRate: number | null;
}

const MIN_BP = 30;
const MAX_BP = 300;
const MIN_HR = 30;
const MAX_HR = 250;

function isReasonableBP(n: number): boolean {
  return n >= MIN_BP && n <= MAX_BP;
}

function isReasonableHR(n: number): boolean {
  return n >= MIN_HR && n <= MAX_HR;
}

export function parseBPFromText(rawText: string[]): ParsedBP | null {
  const joined = rawText.join(' ');

  // Extract all numbers from the text
  const numbers = (joined.match(/\d+/g) || [])
    .map(Number)
    .filter(isReasonableBP);

  if (numbers.length < 2) return null;

  // If we see a slash pattern like "120/80", prioritize it
  const slashMatch = joined.match(/(\d+)\s*\/\s*(\d+)/);
  if (slashMatch) {
    const systolic = Number(slashMatch[1]);
    const diastolic = Number(slashMatch[2]);
    if (isReasonableBP(systolic) && isReasonableBP(diastolic)) {
      // Look for a third number as heart rate
      const remaining = joined.replace(slashMatch[0], '');
      const hrMatch = remaining.match(/\d+/);
      const heartRate = hrMatch && isReasonableHR(Number(hrMatch[0]))
        ? Number(hrMatch[0])
        : null;
      return { systolic, diastolic, heartRate };
    }
  }

  // Otherwise take first 2-3 reasonable numbers
  // Assumption: systolic > diastolic, so first number is systolic
  const systolic = numbers[0];
  const diastolic = numbers[1];
  const heartRate = numbers.length >= 3 && isReasonableHR(numbers[2])
    ? numbers[2]
    : null;

  return { systolic, diastolic, heartRate };
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest src/services/ocr/__tests__/bpParser.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/ocr/
git commit -m "feat: add OCR service interface and BP parser"
```

---

### Task 4: SQLite Database & Reading Repository

**Files:**
- Create: `src/services/database/db.ts`
- Create: `src/services/database/readingRepository.ts`
- Create: `src/services/database/__tests__/readingRepository.test.ts`

- [ ] **Step 1: Create database initialization**

Create `src/services/database/db.ts`:
```typescript
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
```

- [ ] **Step 2: Write failing tests for reading repository**

Create `src/services/database/__tests__/readingRepository.test.ts`:

Note: These tests require the Expo SQLite runtime and should be run as integration tests on a device/simulator. For unit testing in CI, mock the database module. Here we write the tests for the actual device:

```typescript
import { addReading, getAllReadings, getReadingsByDateRange, deleteReading } from '../readingRepository';
import { Reading } from '../../../types/reading';

// These are integration tests — run on device/simulator with:
// npx expo start --ios
// For CI, mock expo-sqlite

jest.mock('../../database/db', () => {
  const mockDb = {
    runAsync: jest.fn(),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn(),
  };
  return {
    getDatabase: jest.fn().mockResolvedValue(mockDb),
    __mockDb: mockDb,
  };
});

const { __mockDb: mockDb } = require('../../database/db');

describe('readingRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('addReading inserts a reading into the database', async () => {
    const reading: Reading = {
      id: 'test-id',
      systolic: 120,
      diastolic: 80,
      heartRate: 72,
      timestamp: '2026-03-14T10:00:00Z',
      notes: null,
      sourceImageUri: null,
    };
    await addReading(reading);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO readings'),
      expect.arrayContaining(['test-id', 120, 80, 72])
    );
  });

  it('getAllReadings returns readings ordered by timestamp desc', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      { id: '1', systolic: 120, diastolic: 80, heartRate: 72, timestamp: '2026-03-14T10:00:00Z', notes: null, sourceImageUri: null },
    ]);
    const readings = await getAllReadings();
    expect(readings).toHaveLength(1);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY timestamp DESC')
    );
  });

  it('deleteReading removes a reading by id', async () => {
    await deleteReading('test-id');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM readings'),
      expect.arrayContaining(['test-id'])
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx jest src/services/database/__tests__/readingRepository.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement reading repository**

Create `src/services/database/readingRepository.ts`:
```typescript
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

export async function deleteReading(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM readings WHERE id = ?', [id]);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest src/services/database/__tests__/readingRepository.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/database/
git commit -m "feat: add SQLite database setup and reading repository"
```

---

## Chunk 2: Report Generation

### Task 5: HTML Report Generator

**Files:**
- Create: `src/services/report/reportHtml.ts`
- Create: `src/services/report/__tests__/reportHtml.test.ts`

- [ ] **Step 1: Write failing tests for HTML report generation**

Create `src/services/report/__tests__/reportHtml.test.ts`:
```typescript
import { generateReportHtml } from '../reportHtml';
import { Reading } from '../../../types/reading';

describe('generateReportHtml', () => {
  const readings: Reading[] = [
    {
      id: '1',
      systolic: 118,
      diastolic: 76,
      heartRate: 72,
      timestamp: '2026-03-14T10:00:00Z',
      notes: null,
      sourceImageUri: null,
    },
    {
      id: '2',
      systolic: 145,
      diastolic: 92,
      heartRate: 80,
      timestamp: '2026-03-13T09:00:00Z',
      notes: null,
      sourceImageUri: null,
    },
  ];

  it('generates HTML with a table', () => {
    const html = generateReportHtml(readings, '2026-03-01', '2026-03-14');
    expect(html).toContain('<table');
    expect(html).toContain('118');
    expect(html).toContain('76');
  });

  it('includes the date range in the header', () => {
    const html = generateReportHtml(readings, '2026-03-01', '2026-03-14');
    expect(html).toContain('2026-03-01');
    expect(html).toContain('2026-03-14');
  });

  it('highlights abnormal readings with red styling', () => {
    const html = generateReportHtml(readings, '2026-03-01', '2026-03-14');
    // 145/92 is High Stage 2 — should be highlighted
    expect(html).toContain('background');
    // Check that the abnormal row has a different style than normal
    expect(html).toMatch(/145.*#F44336|#F44336.*145/s);
  });

  it('shows heart rate column', () => {
    const html = generateReportHtml(readings, '2026-03-01', '2026-03-14');
    expect(html).toContain('Heart Rate');
    expect(html).toContain('72');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/services/report/__tests__/reportHtml.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement HTML report generator**

Create `src/services/report/reportHtml.ts`:
```typescript
import { Reading } from '../../types/reading';
import { classifyBP, BPCategory, BP_COLORS } from '../../utils/bloodPressure';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function generateReportHtml(
  readings: Reading[],
  startDate: string,
  endDate: string
): string {
  const rows = readings
    .map((r) => {
      const category = classifyBP(r.systolic, r.diastolic);
      const isAbnormal = category !== BPCategory.Normal;
      const bgColor = isAbnormal ? BP_COLORS[category] : 'transparent';
      const textColor = isAbnormal ? '#FFFFFF' : '#000000';
      return `
        <tr style="background-color: ${bgColor}; color: ${textColor};">
          <td>${formatDate(r.timestamp)}</td>
          <td>${formatTime(r.timestamp)}</td>
          <td>${r.systolic}</td>
          <td>${r.diastolic}</td>
          <td>${r.heartRate ?? '—'}</td>
        </tr>`;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 20px; }
        h1 { font-size: 20px; }
        p { font-size: 14px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background-color: #f5f5f5; font-weight: 600; }
        .footer { margin-top: 24px; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <h1>Blood Pressure Report</h1>
      <p>${startDate} — ${endDate}</p>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Systolic</th>
            <th>Diastolic</th>
            <th>Heart Rate</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p class="footer">Generated on ${new Date().toLocaleDateString()}</p>
    </body>
    </html>
  `;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/services/report/__tests__/reportHtml.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/report/
git commit -m "feat: add HTML report generator with abnormal value highlighting"
```

---

## Chunk 3: UI Screens

### Task 6: Tab Navigation Shell

**Files:**
- Create: `src/navigation/TabNavigator.tsx`
- Create: `src/screens/ReadingListScreen.tsx` (placeholder)
- Create: `src/screens/CaptureScreen.tsx` (placeholder)
- Create: `src/screens/ReportScreen.tsx` (placeholder)
- Modify: `App.tsx`

- [ ] **Step 1: Install navigation dependencies**

```bash
npx expo install @react-navigation/native @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context @expo/vector-icons
```

- [ ] **Step 2: Create placeholder screens**

Create `src/screens/ReadingListScreen.tsx`:
```tsx
import { View, Text, StyleSheet } from 'react-native';

export default function ReadingListScreen() {
  return (
    <View style={styles.container}>
      <Text>Readings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
```

Create `src/screens/CaptureScreen.tsx`:
```tsx
import { View, Text, StyleSheet } from 'react-native';

export default function CaptureScreen() {
  return (
    <View style={styles.container}>
      <Text>Capture</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
```

Create `src/screens/ReportScreen.tsx`:
```tsx
import { View, Text, StyleSheet } from 'react-native';

export default function ReportScreen() {
  return (
    <View style={styles.container}>
      <Text>Report</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
```

- [ ] **Step 3: Create TabNavigator**

Create `src/navigation/TabNavigator.tsx`:
```tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import ReadingListScreen from '../screens/ReadingListScreen';
import CaptureScreen from '../screens/CaptureScreen';
import ReportScreen from '../screens/ReportScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#2196F3',
        headerShown: true,
      }}
    >
      <Tab.Screen
        name="Readings"
        component={ReadingListScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Capture"
        component={CaptureScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera" size={size + 4} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Report"
        component={ReportScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 4: Update App.tsx**

Replace `App.tsx`:
```tsx
import { NavigationContainer } from '@react-navigation/native';
import TabNavigator from './src/navigation/TabNavigator';

export default function App() {
  return (
    <NavigationContainer>
      <TabNavigator />
    </NavigationContainer>
  );
}
```

- [ ] **Step 5: Verify app runs with tabs**

```bash
npx expo start --ios
```

Expected: app shows 3 tabs (Readings, Capture, Report) with placeholder text.

- [ ] **Step 6: Commit**

```bash
git add src/navigation/ src/screens/ App.tsx
git commit -m "feat: add bottom tab navigation with placeholder screens"
```

---

### Task 7: ReadingRow Component & Reading List Screen

**Files:**
- Create: `src/components/ReadingRow.tsx`
- Modify: `src/screens/ReadingListScreen.tsx`

- [ ] **Step 1: Create ReadingRow component**

Create `src/components/ReadingRow.tsx`:
```tsx
import { View, Text, StyleSheet } from 'react-native';
import { Reading } from '../types/reading';
import { classifyBP, BP_COLORS, BP_LABELS } from '../utils/bloodPressure';

interface Props {
  reading: Reading;
}

export default function ReadingRow({ reading }: Props) {
  const category = classifyBP(reading.systolic, reading.diastolic);
  const color = BP_COLORS[category];
  const label = BP_LABELS[category];

  const date = new Date(reading.timestamp);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.row}>
      <View style={[styles.indicator, { backgroundColor: color }]} />
      <View style={styles.content}>
        <Text style={styles.bp}>
          {reading.systolic}/{reading.diastolic}
          {reading.heartRate ? ` · ${reading.heartRate} bpm` : ''}
        </Text>
        <Text style={styles.meta}>
          {dateStr} {timeStr} · {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  content: { flex: 1 },
  bp: { fontSize: 18, fontWeight: '600' },
  meta: { fontSize: 13, color: '#888', marginTop: 2 },
});
```

- [ ] **Step 2: Implement ReadingListScreen**

Replace `src/screens/ReadingListScreen.tsx`:
```tsx
import { useCallback, useState } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Reading } from '../types/reading';
import { getAllReadings } from '../services/database/readingRepository';
import ReadingRow from '../components/ReadingRow';

export default function ReadingListScreen() {
  const [readings, setReadings] = useState<Reading[]>([]);

  useFocusEffect(
    useCallback(() => {
      getAllReadings().then(setReadings);
    }, [])
  );

  if (readings.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No readings yet.</Text>
        <Text style={styles.emptyHint}>Use the Capture tab to add your first reading.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={readings}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ReadingRow reading={item} />}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#fff' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#333' },
  emptyHint: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' },
});
```

- [ ] **Step 3: Verify the screen renders**

```bash
npx expo start --ios
```

Expected: Readings tab shows "No readings yet" empty state.

- [ ] **Step 4: Commit**

```bash
git add src/components/ReadingRow.tsx src/screens/ReadingListScreen.tsx
git commit -m "feat: add ReadingRow component and ReadingListScreen"
```

---

### Task 8: ReadingForm Component & Capture Screen

**Files:**
- Create: `src/components/ReadingForm.tsx`
- Modify: `src/screens/CaptureScreen.tsx`

- [ ] **Step 1: Create ReadingForm component**

Create `src/components/ReadingForm.tsx`:
```tsx
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from 'react-native';

interface Props {
  initialSystolic?: number;
  initialDiastolic?: number;
  initialHeartRate?: number | null;
  imageUri?: string | null;
  onSave: (systolic: number, diastolic: number, heartRate: number | null, notes: string | null) => void;
  onCancel: () => void;
}

export default function ReadingForm({
  initialSystolic,
  initialDiastolic,
  initialHeartRate,
  imageUri,
  onSave,
  onCancel,
}: Props) {
  const [systolic, setSystolic] = useState(initialSystolic?.toString() ?? '');
  const [diastolic, setDiastolic] = useState(initialDiastolic?.toString() ?? '');
  const [heartRate, setHeartRate] = useState(initialHeartRate?.toString() ?? '');
  const [notes, setNotes] = useState('');

  const canSave = systolic.length > 0 && diastolic.length > 0;

  function handleSave() {
    onSave(
      parseInt(systolic, 10),
      parseInt(diastolic, 10),
      heartRate ? parseInt(heartRate, 10) : null,
      notes || null
    );
  }

  return (
    <View style={styles.container}>
      {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />}

      <Text style={styles.label}>Systolic (mmHg)</Text>
      <TextInput
        style={styles.input}
        value={systolic}
        onChangeText={setSystolic}
        keyboardType="number-pad"
        placeholder="120"
      />

      <Text style={styles.label}>Diastolic (mmHg)</Text>
      <TextInput
        style={styles.input}
        value={diastolic}
        onChangeText={setDiastolic}
        keyboardType="number-pad"
        placeholder="80"
      />

      <Text style={styles.label}>Heart Rate (bpm, optional)</Text>
      <TextInput
        style={styles.input}
        value={heartRate}
        onChangeText={setHeartRate}
        keyboardType="number-pad"
        placeholder="72"
      />

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. after exercise"
        multiline
      />

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.disabledBtn]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  preview: { width: '100%', height: 150, borderRadius: 8, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  notesInput: { height: 60, textAlignVertical: 'top' },
  buttons: { flexDirection: 'row', marginTop: 24, gap: 12 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelText: { fontSize: 16, color: '#666' },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  disabledBtn: { opacity: 0.5 },
  saveText: { fontSize: 16, color: '#fff', fontWeight: '600' },
});
```

- [ ] **Step 2: Implement CaptureScreen**

Replace `src/screens/CaptureScreen.tsx`:
```tsx
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
```

- [ ] **Step 3: Install uuid dependency**

```bash
npm install uuid react-native-get-random-values
npm install --save-dev @types/uuid
```

- [ ] **Step 4: Verify the capture screen**

```bash
npx expo start --ios
```

Expected: Capture tab shows camera view with capture button and manual entry option.

- [ ] **Step 5: Commit**

```bash
git add src/components/ReadingForm.tsx src/screens/CaptureScreen.tsx package.json package-lock.json
git commit -m "feat: add capture screen with camera, OCR, and manual entry"
```

---

### Task 9: Report Screen with PDF Export

**Files:**
- Modify: `src/screens/ReportScreen.tsx`

- [ ] **Step 1: Implement ReportScreen**

Replace `src/screens/ReportScreen.tsx`:
```tsx
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getReadingsByDateRange, getAllReadings } from '../services/database/readingRepository';
import { generateReportHtml } from '../services/report/reportHtml';
import { Reading } from '../types/reading';
import ReadingRow from '../components/ReadingRow';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function thirtyDaysAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

export default function ReportScreen() {
  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadReadings();
    }, [startDate, endDate])
  );

  async function loadReadings() {
    const data = await getReadingsByDateRange(
      `${startDate}T00:00:00Z`,
      `${endDate}T23:59:59Z`
    );
    setReadings(data);
    setLoaded(true);
  }

  async function handleExportPdf() {
    if (readings.length === 0) {
      Alert.alert('No Data', 'No readings in the selected date range.');
      return;
    }
    const html = generateReportHtml(readings, startDate, endDate);
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  }

  return (
    <View style={styles.container}>
      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <Text style={styles.dateLabel}>From</Text>
          <TextInput
            style={styles.dateInput}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
          />
        </View>
        <View style={styles.dateField}>
          <Text style={styles.dateLabel}>To</Text>
          <TextInput
            style={styles.dateInput}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
          />
        </View>
      </View>

      <TouchableOpacity style={styles.loadBtn} onPress={loadReadings}>
        <Text style={styles.loadBtnText}>Load Readings</Text>
      </TouchableOpacity>

      {loaded && readings.length === 0 && (
        <Text style={styles.noData}>No readings in this date range.</Text>
      )}

      <ScrollView style={styles.preview}>
        {readings.map((r) => (
          <ReadingRow key={r.id} reading={r} />
        ))}
      </ScrollView>

      {readings.length > 0 && (
        <TouchableOpacity style={styles.exportBtn} onPress={handleExportPdf}>
          <Text style={styles.exportBtnText}>Export PDF</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  dateRow: { flexDirection: 'row', padding: 16, gap: 12 },
  dateField: { flex: 1 },
  dateLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 4 },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  loadBtn: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  loadBtnText: { fontSize: 15, fontWeight: '600', color: '#333' },
  noData: { textAlign: 'center', color: '#999', marginTop: 32, fontSize: 15 },
  preview: { flex: 1, marginTop: 8 },
  exportBtn: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  exportBtnText: { fontSize: 16, color: '#fff', fontWeight: '600' },
});
```

- [ ] **Step 2: Verify the report screen**

```bash
npx expo start --ios
```

Expected: Report tab shows date range inputs, load button, and export button (disabled when no data).

- [ ] **Step 3: Commit**

```bash
git add src/screens/ReportScreen.tsx
git commit -m "feat: add report screen with date range filter and PDF export"
```

---

## Chunk 4: Final Integration

### Task 10: End-to-End Verification & Cleanup

- [ ] **Step 1: Run all tests**

```bash
npx jest --verbose
```

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript type checking**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Test full flow on iOS simulator**

```bash
npx expo start --ios
```

Manual verification:
1. Open Capture tab → manual entry → save a reading with values 120/80/72
2. Open Capture tab → manual entry → save a reading with values 145/92/80
3. Switch to Readings tab → verify both readings appear with correct colored indicators (green for normal, red for high stage 2)
4. Switch to Report tab → load readings → verify both appear → tap Export PDF → verify PDF opens with share sheet

- [ ] **Step 4: Update CLAUDE.md with build commands**

Update `CLAUDE.md` to include actual build/test/lint commands now that the project is set up.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: end-to-end verification and CLAUDE.md update"
```
