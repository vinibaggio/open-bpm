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
- `debugParser.ts` — re-parse raw EEPROM data from database for offline debugging

#### EEPROM Record Format (14-byte records)

Records are found by pattern-matching `[counter] [0x00]` in the concatenated EEPROM buffer. The timestamp is **bit-packed** across bytes 7-11 (not simple byte-per-field):

```
byte[0]:    counter
byte[1]:    0x00 (delimiter)
byte[2-3]:  measurement data / complement check
byte[4]:    SYS_raw (SYS = raw + 25)
byte[5]:    DIA
byte[6]:    HR
byte[7]:    bits [0:5] = year since 2000
byte[8]:    bits [0:4] = hour, bits [5:7] = day (low 3 bits)
byte[9]:    bits [0:1] = day (high 2 bits), bits [2:5] = month,
            bit 6 = irregular heartbeat, bit 7 = movement detected
byte[10]:   bits [0:5] = second, bits [6:7] = minute (low 2 bits)
byte[11]:   bits [0:3] = minute (high 4 bits)
byte[12-13]: flags
```

This bit layout matches omblepy's `_bytearrayBitsToInt` for hem-7150t/hem-7155t with little-endian interpretation. Test fixtures in `__tests__/fixtures/eepromDump.ts` contain a real 960-byte EEPROM capture cross-validated against the Omron Connect app.

When the clock is not set, year defaults to 0x15 (2021) — these readings are skipped. A second filter removes stale readings from previous recording cycles by finding the largest group of consecutive counters.

Debug logging: `[BLE:Sync]`, `[BLE:Protocol]`, `[BLE:Parser]` prefixes in Metro console.

Reference: Protocol based on [omblepy](https://github.com/userx14/omblepy) and [ubpm](https://codeberg.org/LazyT/ubpm). Local clones at `../omblepy` and `../ubpm` for reference.

### Adding New BPM Devices

To add support for a new blood pressure monitor:
1. Create a new service under `src/services/` (e.g., `src/services/ble-withings/`)
2. Implement scan + fetch logic returning `Reading[]` with `source: 'ble'`
3. Add a sync button or auto-detection in `ReadingListScreen`

### Database

The readings table schema is defined once in `READINGS_SCHEMA` (`src/services/database/db.ts`) and reused wherever the table needs to be recreated. `deleteAllReadings()` uses DROP TABLE + recreate from this constant — do NOT replace it with `DELETE FROM readings`, because DROP+CREATE ensures a clean slate if the schema has changed after a migration, avoiding a corrupted/unusable old table.

### Abnormal Value Thresholds

BP classification is in `src/utils/bloodPressure.ts` (AHA guidelines). Shared between the reading list UI (colored indicators) and PDF report (highlighted rows).

## iOS Build Notes

- **Node path staleness**: `ios/.xcode.env.local` must use `$(command -v node)` not a hardcoded Homebrew Cellar path. Homebrew upgrades break hardcoded paths and cause `PhaseScriptExecution` failures.
- **Xcode 16.4+ SwiftUICore**: The linker cannot link directly with `SwiftUICore`. The Podfile has a post-install hook that replaces `-framework "SwiftUICore"` with `-framework "SwiftUI"`. If the build fails with "cannot link directly with SwiftUICore", clean DerivedData and re-run `pod install`.
- **Clean build recipe**: `rm -rf ios/build ios/Pods ~/Library/Developer/Xcode/DerivedData/bloodpressureapp-* && cd ios && pod install`
