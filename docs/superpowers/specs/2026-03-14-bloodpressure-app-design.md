# Blood Pressure Tracker — Design Spec

## Overview

A personal blood pressure tracking iOS app (React Native) that syncs readings from an Omron BP7150 monitor via Bluetooth, supports manual entry, stores readings locally, and generates printable reports for sharing with clinicians.

## Goals

- Sync readings directly from the Omron BP7150 via Bluetooth
- Manual entry as a fallback input method
- Track readings over time with local storage
- Generate a printable PDF report with abnormal values highlighted for clinician visits
- iOS-first, with a clear path to Android later

## Data Model

Each reading:

| Field     | Type     | Notes                                   |
|-----------|----------|-----------------------------------------|
| id        | string   | UUID                                    |
| systolic  | integer  | mmHg                                    |
| diastolic | integer  | mmHg                                    |
| heartRate | integer? | bpm, optional                           |
| timestamp | string   | ISO 8601, auto-set at capture, editable |
| notes     | string?  | Optional free text                      |
| source    | string   | 'manual' or 'ble'                       |

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
- "Sync from Monitor" button to import readings from Omron BP7150 via BLE
- "Clear All" to delete all readings

### 2. Manual Entry
- Form for manually entering systolic, diastolic, heart rate, and notes
- Saves to local database on confirmation

### 3. Report
- Date range selector
- Preview table of readings with abnormal values highlighted in red
- Generate PDF and share via system share sheet (print, email, AirDrop)

## Technical Stack

- **React Native + Expo SDK 55** (TypeScript)
- **react-native-ble-plx** for Bluetooth communication with Omron BP7150
- **SQLite** (expo-sqlite) for local storage
- **expo-print** for PDF report generation
- **expo-sharing** for PDF export via share sheet

## BLE Architecture

The BLE subsystem communicates with the Omron BP7150 over its custom GATT service (`0000fe4a-0000-1000-8000-00805f9b34fb`). The device is a no-pairing variant — no unlock step is needed.

### GATT Characteristics
- **Unlock** (`b305b680`): read/write/notify — pairing key exchange (not needed for BP7150)
- **TX** (`db5b55e0`): write — commands sent to device
- **RX** (`49123040`): read/notify — responses from device

### Data Transfer Protocol
- EEPROM read/write over TX/RX with XOR checksum packets
- 60 record slots starting at address `0x0098`, read in 16-byte blocks
- Records are 14 bytes in a continuous byte stream (not aligned to block boundaries)
- SYS = raw byte + 25, DIA and HR are direct values

### Protocol References
- [omblepy](https://github.com/userx14/omblepy) — Python CLI for Omron BLE devices
- [ubpm](https://codeberg.org/LazyT/ubpm) — Qt-based Omron BLE manager

## PDF Report Format

Simple HTML table rendered to PDF:
- Header: "Blood Pressure Report" + date range
- Table columns: Date, Time, Systolic, Diastolic, Heart Rate
- Abnormal rows highlighted with colored background
- Footer: generated date

## Future Considerations

- Decode BLE record timestamps (currently uses import time)
- Support additional Omron models
- iCloud sync via CloudKit
- Android support (react-native-ble-plx is cross-platform)
- Trend charts / visualizations
