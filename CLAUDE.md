# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Blood Pressure Tracker — a personal iOS app (with future Android path) for tracking blood pressure readings. Supports Bluetooth sync with Omron BP monitors and manual entry. Generates printable PDF reports for clinician visits.

## Tech Stack

- React Native + Expo SDK 55 (TypeScript)
- SQLite (expo-sqlite) for local storage
- react-native-ble-plx for Bluetooth communication with Omron BP monitors
- expo-print for PDF generation, expo-sharing for export
- @react-navigation/bottom-tabs for navigation

## Common Commands

```bash
npm start              # Start Expo dev server
npm test               # Run all tests (Jest)
npx jest path/to/test  # Run a single test file
npm run typecheck      # TypeScript type checking (tsc --noEmit)
npx expo run:ios --device "device name"  # Build and deploy to physical device
```

## Architecture

### Directory Structure

- `src/types/` — TypeScript interfaces (Reading with `source: 'manual' | 'ble'`)
- `src/utils/` — Pure utility functions (BP classification, thresholds, colors)
- `src/services/ble/` — Omron BLE protocol: scan, connect, EEPROM read, record parsing
- `src/services/database/` — SQLite setup and reading CRUD repository
- `src/services/report/` — HTML report generator for PDF export
- `src/screens/` — Three tab screens: ReadingList, Manual Entry, Report
- `src/components/` — Reusable UI components (ReadingRow, ReadingForm)
- `src/navigation/` — Bottom tab navigator

### BLE Sync (Omron BP7150)

The app imports readings directly from an Omron BP7150 via Bluetooth using `react-native-ble-plx`. The protocol implementation in `src/services/ble/` handles Omron's custom GATT protocol over service `0000fe4a`. The BP7150 is a no-pairing variant — no unlock step needed, just connect and read EEPROM.

Key files:
- `types.ts` — GATT UUIDs, constants, memory layout
- `omronProtocol.ts` — packet framing, CRC, commands
- `omronParser.ts` — extracts BP readings from raw EEPROM byte stream (14-byte records, SYS = raw + 25)
- `bleSync.ts` — high-level scan, connect, fetch, import orchestration

Debug logging: `[BLE:Sync]`, `[BLE:Protocol]`, `[BLE:Parser]` prefixes in Metro console.

Reference: Protocol based on [omblepy](https://github.com/userx14/omblepy) and [ubpm](https://codeberg.org/LazyT/ubpm).

### Adding New BPM Devices

To add support for a new blood pressure monitor:
1. Create a new service under `src/services/` (e.g., `src/services/ble-withings/`)
2. Implement scan + fetch logic returning `Reading[]` with `source: 'ble'`
3. Add a sync button or auto-detection in `ReadingListScreen`

### Database

The readings table schema is defined once in `READINGS_SCHEMA` (`src/services/database/db.ts`) and reused wherever the table needs to be recreated. `deleteAllReadings()` uses DROP TABLE + recreate from this constant — do NOT replace it with `DELETE FROM readings`, because DROP+CREATE ensures a clean slate if the schema has changed after a migration, avoiding a corrupted/unusable old table.

### Abnormal Value Thresholds

BP classification is in `src/utils/bloodPressure.ts` (AHA guidelines). Shared between the reading list UI (colored indicators) and PDF report (highlighted rows).
