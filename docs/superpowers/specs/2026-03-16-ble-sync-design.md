# BLE Blood Pressure Sync — Design Spec

## Overview

Add Bluetooth sync to import readings directly from the Omron BP7150 monitor, bypassing the camera/OCR pipeline entirely. The BP7150 stores up to 60 readings in EEPROM, accessible via a custom Omron BLE protocol (documented by the omblepy open-source project).

## Target Device

Omron BP7150 (internally HEM-7150T). Single-user device, 60 record slots, little-endian byte order, systolic offset of +25.

## UX Flow

### First-time Pairing
1. User puts monitor in pairing mode (hold START/STOP until "-P-" shows on display)
2. User taps "Pair Monitor" in the app
3. App scans for Omron devices, connects, performs key exchange
4. iOS shows BLE pairing dialog — user confirms
5. App stores pairing state locally
6. Success message

### Syncing Readings
1. User taps "Sync from Monitor" on the Reading List screen
2. App connects to the paired device, unlocks with stored key
3. Fetches all 60 record slots from EEPROM
4. Parses records, skips empty slots (all `0xFF`) and duplicates (matching timestamp)
5. Imports new readings into SQLite via existing `addReading`
6. Shows "Imported N new readings" message

## Protocol Details

### GATT Service & Characteristics

**Parent Service:** `ecbe3980-c9a2-11e1-b1bd-0002a5d5c51b`

**TX Channels (write to device):**
| Channel | UUID |
|---------|------|
| TX 0 | `db5b55e0-aee7-11e1-965e-0002a5d5c51b` |
| TX 1 | `e0b8a060-aee7-11e1-92f4-0002a5d5c51b` |
| TX 2 | `0ae12b00-aee8-11e1-a192-0002a5d5c51b` |
| TX 3 | `10e1ba60-aee8-11e1-89e5-0002a5d5c51b` |

**RX Channels (notify from device):**
| Channel | UUID |
|---------|------|
| RX 0 | `49123040-aee8-11e1-a74d-0002a5d5c51b` |
| RX 1 | `4d0bf320-aee8-11e1-a0d9-0002a5d5c51b` |
| RX 2 | `5128ce60-aee8-11e1-b84b-0002a5d5c51b` |
| RX 3 | `560f1420-aee8-11e1-8184-0002a5d5c51b` |

**Unlock Characteristic:** `b305b680-aee7-11e1-a730-0002a5d5c51b`

### Pairing (First Time)

1. Connect to device
2. Enable notifications on RX channel 0 (triggers OS-level BLE pairing)
3. Enable notifications on Unlock characteristic
4. Write `0x02` + 16 zero bytes to Unlock (enter programming mode)
5. Wait for response `0x8200` (success)
6. Write `0x00` + 16-byte key to Unlock (program key)
7. Wait for response `0x8000` (key stored)
8. Run start/end transmission cycle

**Key:** `deadbeaf12341234deadbeaf12341234` (16 bytes, arbitrary but must be consistent)

### Unlock (Subsequent Connections)

1. Connect to device
2. Enable notifications on Unlock characteristic
3. Write `0x01` + 16-byte key to Unlock
4. Wait for response `0x8100` (authenticated)

### Data Transfer Protocol

Messages are sent across TX channels (max 16 bytes each). Format:

```
[total_len] [cmd_hi] [cmd_lo] [addr_hi] [addr_lo] [data_len] [data...] [0x00] [xor_crc]
```

XOR checksum: all bytes XORed must equal 0.

**Commands:**
| Command | Bytes | Full packet |
|---------|-------|-------------|
| Start transmission | `0x0000` | `0800000000100018` |
| Read EEPROM | `0x0100` | `08 01 00 [addr_hi] [addr_lo] [size] 00 [crc]` |
| End transmission | `0x0f00` | `080f000000000007` |

**Responses:**
| Response | Bytes | Meaning |
|----------|-------|---------|
| Start ACK | `0x8000` | Session started |
| Read data | `0x8100` | Contains EEPROM data |
| End ACK | `0x8f00` | Session ended |

### Record Format (16 bytes, little-endian)

| Field | Bit range | Width | Encoding |
|-------|-----------|-------|----------|
| Minute | 68-73 | 6 bits | Direct (0-59) |
| Second | 74-79 | 6 bits | Direct, clamp to max 59 |
| Movement flag | 80 | 1 bit | 0=no, 1=yes |
| Irregular heartbeat | 81 | 1 bit | 0=normal, 1=irregular |
| Month | 82-85 | 4 bits | 1-12 |
| Day | 86-90 | 5 bits | 1-31 |
| Hour | 91-95 | 5 bits | 0-23 |
| Year | 98-103 | 6 bits | Value + 2000 |
| Pulse (BPM) | 104-111 | 8 bits | Direct |
| Diastolic (mmHg) | 112-119 | 8 bits | Direct |
| Systolic (mmHg) | 120-127 | 8 bits | Value + 25 |

Bit extraction: interpret 16 bytes as a little-endian 128-bit integer, then shift and mask.

Empty record: all 16 bytes are `0xFF` — skip.

### Memory Layout

| Parameter | Value |
|-----------|-------|
| Record start address | `0x0098` |
| Records per user | 60 |
| Record size | 16 bytes |
| Block size | 16 bytes |

## Architecture

### Dependencies
- `react-native-ble-plx` — BLE communication

### File Structure

```
src/services/ble/
  types.ts           — UUIDs, constants, BLE types
  omronProtocol.ts   — Connect, pair, unlock, EEPROM read, packet framing, CRC
  omronParser.ts     — Parse 16-byte records into readings (pure functions, no BLE)
  bleSync.ts         — High-level: scan, connect, fetch, deduplicate, import
```

### Modified Files
- `src/screens/ReadingListScreen.tsx` — add "Sync from Monitor" button and pairing flow
- `app.json` — add `NSBluetoothAlwaysUsageDescription`

### Deduplication
When importing, check existing readings by timestamp. If a reading with the same timestamp already exists in SQLite, skip it. This makes sync idempotent — users can tap "Sync" multiple times safely.

## Testing

### Unit Tests (no BLE needed)
- **omronParser.test.ts** — parse known byte sequences, verify systolic/diastolic/pulse/timestamp extraction. Test the +25 systolic offset. Test empty record detection. Test second clamping.
- **omronProtocol.test.ts** — verify packet construction, CRC calculation, response parsing.

### Integration Tests (on device)
- Pair with BP7150, sync readings, verify they appear in the reading list.

## Error Handling
- Device not found → "Make sure your monitor is nearby and turned on"
- Pairing fails → "Put your monitor in pairing mode (-P- on display) and try again"
- Unlock fails → "Pairing may have been reset. Try re-pairing."
- Read timeout → retry up to 5 times per block, then fail with "Sync interrupted"
- No new readings → "No new readings found on the monitor"
