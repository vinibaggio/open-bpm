# Blood Pressure Tracker — Design Spec

## Overview

A personal blood pressure tracking iOS app (React Native) that lets users photograph their BP monitor display, automatically extracts readings via OCR, stores them locally, and generates printable reports for sharing with clinicians.

## Goals

- Snap a photo of a BP monitor and have systolic, diastolic, and heart rate extracted automatically
- Track readings over time with local storage
- Generate a printable PDF report with abnormal values highlighted for clinician visits
- iOS-first, with a clear path to Android later

## Data Model

Each reading:

| Field          | Type     | Notes                                  |
|----------------|----------|----------------------------------------|
| id             | string   | UUID                                   |
| systolic       | integer  | mmHg                                   |
| diastolic      | integer  | mmHg                                   |
| heartRate      | integer? | bpm, optional                          |
| timestamp      | string   | ISO 8601, auto-set at capture, editable|
| notes          | string?  | Optional free text                     |
| sourceImageUri | string?  | Path to original photo                 |

### Abnormal Thresholds (AHA Guidelines)

| Category       | Systolic        | Diastolic      |
|----------------|-----------------|----------------|
| Normal         | < 120           | AND < 80       |
| Elevated       | 120–129         | AND < 80       |
| High (Stage 1) | 130–139         | OR 80–89       |
| High (Stage 2) | >= 140          | OR >= 90       |
| Crisis         | > 180           | OR > 120       |

## App Structure

Three screens with a bottom tab bar:

### 1. Reading List (Home)
- Chronological list of all readings
- Each row: date/time, systolic/diastolic, heart rate
- Colored indicator for abnormal values (yellow=elevated, orange=stage 1, red=stage 2/crisis)

### 2. Capture (Center Tab, Prominent)
- Opens camera to photograph BP monitor display
- OCR extracts numbers, presents for confirmation/editing
- Manual entry fallback if OCR fails or user prefers typing
- Saves to local database on confirmation

### 3. Report
- Date range selector
- Preview table of readings with abnormal values highlighted in red
- Generate PDF and share via system share sheet (print, email, AirDrop)

## Technical Stack

- **React Native + Expo** (managed workflow, eject if needed for native modules)
- **expo-camera** for photo capture
- **Native module (Swift)** for Apple Vision OCR on iOS
- **SQLite** (expo-sqlite) for local storage
- **react-native-html-to-pdf** for PDF report generation
- **expo-sharing** for PDF export via share sheet

## OCR Architecture

The OCR subsystem uses a platform-agnostic interface so the underlying implementation can be swapped per platform (Apple Vision on iOS, Google ML Kit on Android in the future).

### Platform-Agnostic Interface

```typescript
interface OCRResult {
  rawText: string[];   // Array of recognized text strings
  confidence: number;  // 0-1 confidence score
}

interface OCRService {
  recognizeText(imageUri: string): Promise<OCRResult>;
}
```

### Implementation Strategy

- **iOS:** `AppleVisionOCRService` implements `OCRService` using a Swift native module wrapping Apple's Vision framework
- **Android (future):** `GoogleMLKitOCRService` implements `OCRService` using Google ML Kit text recognition
- The active implementation is selected at runtime based on `Platform.OS`

### OCR Flow

1. User takes photo → saved to app storage
2. Photo URI passed to `OCRService.recognizeText()` → returns recognized text strings
3. **JS-side parser** (shared across platforms) scans for number patterns typical of BP monitors and extracts systolic, diastolic, heart rate
4. Extracted values presented to user for confirmation or manual correction
5. Confirmed reading saved to SQLite

The JS-side parser is intentionally separate from the OCR service so that parsing logic is shared and testable regardless of platform.

## PDF Report Format

Simple HTML table rendered to PDF:

- Header: "Blood Pressure Report" + date range
- Table columns: Date, Time, Systolic, Diastolic, Heart Rate
- Abnormal rows highlighted with red background/text
- Footer: generated date

## Future Considerations (Not Built Now)

- iCloud sync via CloudKit native module
- Android support: add Google ML Kit implementation behind the existing OCRService interface
- Trend charts / visualizations
