import { OmronReading } from './types';

/**
 * Extract bits from a 16-byte little-endian record.
 * Treats the 16 bytes as a 128-bit little-endian integer,
 * then extracts `width` bits starting at `startBit`.
 */
function extractBits(record: Uint8Array, startBit: number, width: number): number {
  let value = BigInt(0);
  for (let i = 0; i < 16; i++) {
    value |= BigInt(record[i]) << BigInt(i * 8);
  }
  return Number((value >> BigInt(startBit)) & BigInt((1 << width) - 1));
}

export function isEmptyRecord(record: Uint8Array): boolean {
  return record.every((byte) => byte === 0xff);
}

export function parseRecord(record: Uint8Array): OmronReading | null {
  if (isEmptyRecord(record)) return null;

  const minute = extractBits(record, 68, 6);
  const second = Math.min(extractBits(record, 74, 6), 59);
  const movementDetected = extractBits(record, 80, 1) === 1;
  const irregularHeartbeat = extractBits(record, 81, 1) === 1;
  const month = extractBits(record, 82, 4);
  const day = extractBits(record, 86, 5);
  const hour = extractBits(record, 91, 5);
  const year = extractBits(record, 98, 6) + 2000;
  const heartRate = extractBits(record, 104, 8);
  const diastolic = extractBits(record, 112, 8);
  const systolic = extractBits(record, 120, 8) + 25;

  // Basic sanity check — month 0 means invalid record
  if (month === 0 || month > 12 || day === 0 || day > 31) return null;

  const timestamp = new Date(year, month - 1, day, hour, minute, second);

  console.log(
    `[BLE:Parser] Record: ${systolic}/${diastolic} HR=${heartRate} ` +
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ` +
    `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}` +
    `${irregularHeartbeat ? ' [IRREGULAR]' : ''}${movementDetected ? ' [MOVEMENT]' : ''}`
  );

  return {
    systolic,
    diastolic,
    heartRate,
    timestamp,
    irregularHeartbeat,
    movementDetected,
  };
}

/**
 * Debug helper: dump a record's raw bytes and parsed fields.
 */
export function dumpRecord(record: Uint8Array, index: number): void {
  const hex = Array.from(record).map(b => b.toString(16).padStart(2, '0')).join(' ');
  console.log(`[BLE:Parser] Record #${index} raw: ${hex}`);

  if (isEmptyRecord(record)) {
    console.log(`[BLE:Parser] Record #${index}: EMPTY`);
    return;
  }

  const parsed = parseRecord(record);
  if (!parsed) {
    console.log(`[BLE:Parser] Record #${index}: INVALID (failed sanity check)`);
  }
}
