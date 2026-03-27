# Blood Pressure Tracker

A personal iOS/Android app for tracking blood pressure readings. Supports Bluetooth sync with compatible blood pressure monitors and manual entry. Generates printable PDF reports for clinician visits.

Built with React Native + Expo (TypeScript).

## Supported Devices

| Manufacturer | Model | Connection | Notes |
|---|---|---|---|
| Omron | BP7150 (HEM-7150T) | Bluetooth (no pairing) | Reads up to 60 stored readings via custom GATT protocol over service `0000fe4a` |

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- For iOS: Xcode and a physical device (BLE does not work in the simulator)
- For Android: Android Studio and a physical device

### Installation

```bash
git clone https://github.com/vinibaggio/open-bpm.git
cd bloodpressure
npm install
```

### Running

```bash
npm start                                        # Start Expo dev server
npx expo run:ios --device "Your Device Name"     # Build and deploy to iOS device
npx expo run:android --device                    # Build and deploy to Android device
```

### Testing

```bash
npm test               # Run all tests (Jest)
npx jest path/to/test  # Run a single test file
npm run typecheck      # TypeScript type checking
```

## Project Structure

```
src/
├── types/           TypeScript interfaces (Reading, etc.)
├── utils/           Pure utilities (BP classification, thresholds, colors)
├── services/
│   ├── ble/         Omron BLE protocol: scan, connect, EEPROM read, record parsing
│   ├── database/    SQLite setup and reading CRUD
│   └── report/      HTML report generator for PDF export
├── screens/         Tab screens: ReadingList, Manual Entry, Report
├── components/      Reusable UI components (ReadingRow, ReadingForm)
└── navigation/      Bottom tab navigator
```

## Contributing

### Adding Support for a New Blood Pressure Monitor

The app is designed to support multiple BLE blood pressure monitors. Each device gets its own service module. To add a new device:

1. **Create a new service directory** under `src/services/` (e.g., `src/services/ble-withings/`).

2. **Implement the BLE protocol** for your device. Your module needs to:
   - Scan for and connect to the device
   - Read stored measurements from the device
   - Return an array of `Reading` objects with `source: 'ble'`

   The `Reading` interface (`src/types/reading.ts`):
   ```typescript
   interface Reading {
     id: string;          // UUID
     systolic: number;
     diastolic: number;
     heartRate: number | null;
     timestamp: string;   // ISO 8601 — must come from the device's stored timestamp
     notes: string | null;
     source: 'manual' | 'ble';
   }
   ```

   **Important:** The `timestamp` must be decoded from the device's stored data, not the time of import. Duplicate detection relies on timestamps to avoid re-importing readings.

3. **Wire it up in the UI.** Add a sync button or auto-detection in `ReadingListScreen` (`src/screens/ReadingListScreen.tsx`).

4. **Update the supported devices table** in this README.

Use the existing Omron implementation in `src/services/ble/` as a reference. Key files:
- `types.ts` — GATT UUIDs, constants, memory layout
- `omronProtocol.ts` — packet framing, CRC, commands
- `omronParser.ts` — extracts BP readings from raw EEPROM data
- `bleSync.ts` — high-level scan/connect/fetch/import orchestration

### General Guidelines

- Run `npm test` and `npm run typecheck` before submitting changes
- BP classification follows AHA guidelines — see `src/utils/bloodPressure.ts`
- BLE debug logging uses prefixed tags: `[BLE:Sync]`, `[BLE:Protocol]`, `[BLE:Parser]`

## Acknowledgements

The Omron BP7150 Bluetooth implementation is based on the protocol reverse-engineering work from:

- **[omblepy](https://github.com/userx14/omblepy)** by userx14 — Python library for communicating with Omron BLE blood pressure monitors
- **[ubpm](https://codeberg.org/LazyT/ubpm)** by LazyT — Universal blood pressure monitor tool

Their work documenting the Omron custom GATT protocol, EEPROM memory layout, and packet framing made the BLE sync feature possible.

## License

MIT License. See [LICENSE](LICENSE) for details.
