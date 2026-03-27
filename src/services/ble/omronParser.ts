import { OmronReading, RECORDS_PER_USER } from './types';
import { bytesToHex } from './omronProtocol';

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

    // Decode timestamp from bytes [7-11] using omblepy bit-field layout.
    // The timestamp is bit-packed across bytes 7-11 (relative to record start):
    //   byte[7] bits [0:5] = year since 2000 (6 bits)
    //   byte[8] bits [0:4] = hour (5 bits)
    //   byte[8] bits [5:7] + byte[9] bits [0:1] = day (5 bits)
    //   byte[9] bits [2:5] = month (4 bits)
    //   byte[9] bit 6 = irregular heartbeat
    //   byte[9] bit 7 = movement detected
    //   byte[10] bits [0:5] = second (6 bits)
    //   byte[10] bits [6:7] + byte[11] bits [0:3] = minute (6 bits)
    const b7 = buffer[i + 7];
    const b8 = buffer[i + 8];
    const b9 = buffer[i + 9];
    const b10 = buffer[i + 10];
    const b11 = buffer[i + 11];

    const year = (b7 & 0x3F) + 2000;
    const hour = b8 & 0x1F;
    const day = ((b9 & 0x03) << 3) | (b8 >> 5);
    const month = (b9 >> 2) & 0x0F;
    const irregularHeartbeat = ((b9 >> 6) & 1) === 1;
    const movementDetected = ((b9 >> 7) & 1) === 1;
    const second = Math.min(b10 & 0x3F, 59); // can range 0-63, cap at 59
    const minute = ((b11 & 0x0F) << 2) | (b10 >> 6);

    // Skip readings without valid timestamps:
    // - default year 0x15 (21 = 2021) means clock was not set
    // - year outside 2024-2035 means bogus/stale EEPROM data
    const hasValidTimestamp = year !== 2021 && year >= 2024 && year <= 2035
      && month >= 1 && month <= 12 && day >= 1 && day <= 31;

    if (!hasValidTimestamp) {
      console.log(
        `[BLE:Parser] Skipping reading at offset ${i}: ` +
        `counter=0x${counter.toString(16)} SYS=${sys} DIA=${dia} HR=${hr} ` +
        `(clock not set, raw: ${bytesToHex(buffer.slice(i, i + 14))})`
      );
      i += 12;
      continue;
    }

    const timestamp = new Date(year, month - 1, day, hour, minute, second);

    console.log(
      `[BLE:Parser] Found reading at offset ${i}: ` +
      `counter=0x${counter.toString(16)} SYS=${sys} DIA=${dia} HR=${hr} ` +
      `timestamp=${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ` +
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')} ` +
      `mov=${movementDetected ? 1 : 0} ihb=${irregularHeartbeat ? 1 : 0} ` +
      `(raw: ${bytesToHex(buffer.slice(i, i + 14))})`
    );

    readings.push({
      counter,
      systolic: sys,
      diastolic: dia,
      heartRate: hr,
      timestamp,
      irregularHeartbeat,
      movementDetected,
    });

    // Skip ahead past this record (records are ~14 bytes)
    i += 12;
  }

  // Filter stale EEPROM data: find the largest group of readings with
  // consecutive counters (gaps of ≤4 allowed). Stale data from previous
  // recording cycles will have isolated/distant counters.
  if (readings.length > 1) {
    const sorted = [...readings].sort((a, b) => a.counter - b.counter);
    let bestStart = 0, bestLen = 1, curStart = 0, curLen = 1;
    for (let j = 1; j < sorted.length; j++) {
      if (sorted[j].counter - sorted[j - 1].counter <= 4) {
        curLen++;
      } else {
        curStart = j;
        curLen = 1;
      }
      if (curLen > bestLen) {
        bestStart = curStart;
        bestLen = curLen;
      }
    }
    const kept = new Set(sorted.slice(bestStart, bestStart + bestLen));
    const filtered = readings.filter(r => {
      if (kept.has(r)) return true;
      console.log(
        `[BLE:Parser] Filtering stale reading: counter=0x${r.counter.toString(16)} ` +
        `SYS=${r.systolic} DIA=${r.diastolic}`
      );
      return false;
    });
    console.log(`[BLE:Parser] Found ${filtered.length} current readings (${readings.length - filtered.length} stale filtered)`);
    return filtered;
  }

  console.log(`[BLE:Parser] Found 0 valid readings in byte stream`);
  return readings;
}

