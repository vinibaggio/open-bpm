import { OmronReading } from './types';

/**
 * Check if a 16-byte block is all 0xFF (empty EEPROM slot)
 */
export function isEmptyRecord(record: Uint8Array): boolean {
  return record.every((byte) => byte === 0xff);
}

/**
 * Parse all readings from the raw EEPROM byte stream.
 *
 * The BP7150 stores records as a continuous byte stream where each record
 * is approximately 14 bytes. Records do NOT align to 16-byte read boundaries.
 *
 * Record format (discovered by matching known reading 120/69/59):
 *   [counter] [00] [B2] [B3] [SYS_raw] [DIA] [HR] [7 bytes timestamp/metadata]
 *
 * Where: SYS = SYS_raw + 25, DIA and HR are direct values.
 *
 * Strategy: Concatenate all raw blocks into a single buffer, then scan for
 * valid BP value triplets.
 */
export function parseAllRecords(blocks: Uint8Array[]): OmronReading[] {
  // Concatenate all blocks into a single buffer
  const totalLen = blocks.reduce((sum, b) => sum + b.length, 0);
  const buffer = new Uint8Array(totalLen);
  let offset = 0;
  for (const block of blocks) {
    buffer.set(block, offset);
    offset += block.length;
  }

  console.log(`[BLE:Parser] Concatenated ${blocks.length} blocks into ${totalLen} byte buffer`);

  // Skip the first ~576 bytes (36 blocks) — that's settings/config, not records.
  // Actual BP records start around block 37 (offset 592).
  const RECORD_AREA_START = 576;

  const readings: OmronReading[] = [];
  const seen = new Set<string>(); // dedup by values

  // Scan the buffer looking for the pattern:
  // [counter] [0x00] [??] [??] [SYS_raw] [DIA] [HR]
  // where SYS_raw+25 is 70-250, DIA is 40-150, HR is 30-220
  for (let i = RECORD_AREA_START; i < buffer.length - 7; i++) {
    // Check for [XX] [00] pattern
    if (buffer[i + 1] !== 0x00) continue;

    const sysRaw = buffer[i + 4];
    const dia = buffer[i + 5];
    const hr = buffer[i + 6];
    const sys = sysRaw + 25;

    // Validate BP ranges
    if (sys < 70 || sys > 250) continue;
    if (dia < 40 || dia > 150) continue;
    if (hr < 30 || hr > 220) continue;
    if (dia >= sys) continue;

    // Additional check: byte[i+2] and byte[i+3] should look like timestamp
    // components (not all zeros or all FFs)
    const b2 = buffer[i + 2];
    const b3 = buffer[i + 3];
    if (b2 === 0xff && b3 === 0xff) continue;

    // Dedup by SYS/DIA/HR/counter
    const key = `${buffer[i]}-${sys}-${dia}-${hr}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Try to extract timestamp from bytes after the measurement
    // For now, use the counter byte as a relative ordering
    const counter = buffer[i];

    // Attempt timestamp from surrounding bytes
    // The bytes after HR seem to follow pattern: [15/XX] [20/XX] [04/XX] ...
    // For now, use import time since we can't reliably decode timestamps yet
    const timestamp = new Date(); // will be set to import time

    console.log(
      `[BLE:Parser] Found reading at offset ${i}: ` +
      `counter=0x${counter.toString(16)} SYS=${sys} DIA=${dia} HR=${hr} ` +
      `(raw: ${Array.from(buffer.slice(i, i + 14)).map(b => b.toString(16).padStart(2, '0')).join(' ')})`
    );

    readings.push({
      systolic: sys,
      diastolic: dia,
      heartRate: hr,
      timestamp,
      irregularHeartbeat: false,
      movementDetected: false,
    });

    // Skip ahead past this record (records are ~14 bytes)
    i += 12;
  }

  console.log(`[BLE:Parser] Found ${readings.length} valid readings in byte stream`);
  return readings;
}

// Keep the old single-record parser for backward compatibility
export function parseRecord(record: Uint8Array): OmronReading | null {
  if (isEmptyRecord(record)) return null;
  // Use the stream parser with a single block
  const results = parseAllRecords([record]);
  return results.length > 0 ? results[0] : null;
}

/**
 * Debug helper: dump a block's raw bytes.
 */
export function dumpRecord(record: Uint8Array, index: number): void {
  const hex = Array.from(record).map(b => b.toString(16).padStart(2, '0')).join(' ');
  console.log(`[BLE:Parser] Block #${index}: ${hex}`);
}
