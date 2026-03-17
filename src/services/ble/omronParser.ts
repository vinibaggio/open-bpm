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
 * is 14 bytes.
 *
 * Record format (14 bytes):
 *   [0] counter
 *   [1] 0x00 (delimiter)
 *   [2] measurement_data (complement-checked with byte[3])
 *   [3] ~byte[2] (bitwise complement for error detection)
 *   [4] SYS_raw (SYS = raw + 25)
 *   [5] DIA
 *   [6] HR
 *   [7] year (since 2000)
 *   [8] minute (bit 3 = clock-set flag, clear for value)
 *   [9] hour
 *   [10] (upper 2 bits: month-1, lower 6 bits: second)
 *   [11] day (bit 3 = clock-set flag, clear for value)
 *   [12-13] flags
 *
 * When the monitor's clock is not set, bytes [7-13] contain defaults
 * (typically year=0x15=21). In that case we fall back to import time.
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

    const counter = buffer[i];

    // Decode timestamp from bytes [7-13] of the record
    const yearRaw = buffer[i + 7];
    const minuteRaw = buffer[i + 8];
    const hourRaw = buffer[i + 9];
    const monthSecRaw = buffer[i + 10];
    const dayRaw = buffer[i + 11];

    // Check if the clock was set: default year is 0x15 (21 = 2021)
    const clockIsSet = yearRaw !== 0x15;

    let timestamp: Date;
    if (clockIsSet) {
      const year = 2000 + yearRaw;
      const minute = minuteRaw & 0xF7; // clear bit 3 (clock-set flag)
      const hour = hourRaw;
      const month = (monthSecRaw >> 6) + 1; // upper 2 bits + 1
      const day = dayRaw & 0xF7; // clear bit 3 (clock-set flag)
      const second = monthSecRaw & 0x3F; // lower 6 bits

      timestamp = new Date(year, month - 1, day, hour, minute, second);

      console.log(
        `[BLE:Parser] Found reading at offset ${i}: ` +
        `counter=0x${counter.toString(16)} SYS=${sys} DIA=${dia} HR=${hr} ` +
        `timestamp=${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ` +
        `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')} ` +
        `(raw: ${Array.from(buffer.slice(i, i + 14)).map(b => b.toString(16).padStart(2, '0')).join(' ')})`
      );
    } else {
      timestamp = new Date(); // fall back to import time

      console.log(
        `[BLE:Parser] Found reading at offset ${i}: ` +
        `counter=0x${counter.toString(16)} SYS=${sys} DIA=${dia} HR=${hr} ` +
        `timestamp=import-time (clock not set) ` +
        `(raw: ${Array.from(buffer.slice(i, i + 14)).map(b => b.toString(16).padStart(2, '0')).join(' ')})`
      );
    }

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
