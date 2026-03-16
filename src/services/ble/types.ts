// Omron custom GATT service UUID from omblepy (used by some models, NOT the BP7150)
export const OMRON_SERVICE_UUID = 'ecbe3980-c9a2-11e1-b1bd-0002a5d5c51b';

// Omron communication service on BP7150 — contains unlock, TX, RX characteristics
export const OMRON_ADVERTISE_UUID = '0000fe4a-0000-1000-8000-00805f9b34fb';

// The service UUID used for actual communication (unlock, read, write)
// BP7150 uses 0000fe4a, not ecbe3980
export const OMRON_COMM_SERVICE_UUID = OMRON_ADVERTISE_UUID;

// Standard Bluetooth Blood Pressure Service (BP7150 advertises this in pairing mode)
export const BT_BLOOD_PRESSURE_UUID = '00001810-0000-1000-8000-00805f9b34fb';

// All UUIDs to scan for
export const OMRON_SCAN_UUIDS = [OMRON_SERVICE_UUID, OMRON_ADVERTISE_UUID, BT_BLOOD_PRESSURE_UUID];

export const UNLOCK_CHAR_UUID = 'b305b680-aee7-11e1-a730-0002a5d5c51b';

export const TX_CHAR_UUIDS = [
  'db5b55e0-aee7-11e1-965e-0002a5d5c51b',
  'e0b8a060-aee7-11e1-92f4-0002a5d5c51b',
  '0ae12b00-aee8-11e1-a192-0002a5d5c51b',
  '10e1ba60-aee8-11e1-89e5-0002a5d5c51b',
] as const;

export const RX_CHAR_UUIDS = [
  '49123040-aee8-11e1-a74d-0002a5d5c51b',
  '4d0bf320-aee8-11e1-a0d9-0002a5d5c51b',
  '5128ce60-aee8-11e1-b84b-0002a5d5c51b',
  '560f1420-aee8-11e1-8184-0002a5d5c51b',
] as const;

// Arbitrary 16-byte key (must be consistent across sessions)
export const PAIRING_KEY = new Uint8Array([
  0xde, 0xad, 0xbe, 0xaf, 0x12, 0x34, 0x12, 0x34,
  0xde, 0xad, 0xbe, 0xaf, 0x12, 0x34, 0x12, 0x34,
]);

// BP7150 (HEM-7150T) memory layout
export const RECORD_START_ADDRESS = 0x0098;
export const RECORDS_PER_USER = 60;
export const RECORD_SIZE = 16;
export const BLOCK_SIZE = 16;

export interface OmronReading {
  systolic: number;
  diastolic: number;
  heartRate: number;
  timestamp: Date;
  irregularHeartbeat: boolean;
  movementDetected: boolean;
}
