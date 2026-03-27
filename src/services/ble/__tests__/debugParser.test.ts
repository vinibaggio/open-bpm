import { encodeRawBlocks, decodeRawBlocks, reparseFromRawData, hexDumpRawData, debugParseReport } from '../debugParser';

// Helper: build a valid record block at the expected EEPROM position
// Record format (14 bytes within a 16-byte block):
//   [0] counter  [1] 0x00  [2] meas_data  [3] ~meas_data
//   [4] SYS_raw (SYS = raw + 25)  [5] DIA  [6] HR
//   [7] year (since 2000)  [8] minute (bit 3 = clock flag)
//   [9] hour  [10] (upper 2 bits: month-1, lower 6 bits: second)
//   [11] day (bit 3 = clock flag)  [12-13] flags
function makeRecordBlock(opts: {
  counter: number;
  sys: number;
  dia: number;
  hr: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
}): Uint8Array {
  const block = new Uint8Array(16);
  block[0] = opts.counter;
  block[1] = 0x00; // delimiter
  block[2] = 0x4f; // measurement data
  block[3] = 0xb0; // complement
  block[4] = opts.sys - 25; // SYS_raw
  block[5] = opts.dia;
  block[6] = opts.hr;
  block[7] = opts.year - 2000; // year since 2000
  block[8] = opts.minute; // minute (no clock flag set for simplicity)
  block[9] = opts.hour;
  const second = opts.second ?? 0;
  block[10] = ((opts.month - 1) << 6) | (second & 0x3f); // upper 2 bits: month-1, lower 6: second
  block[11] = opts.day; // day (no clock flag)
  block[12] = 0x80;
  block[13] = 0x01;
  return block;
}

// 36 padding blocks to fill the config area (576 bytes) before records
function makePadding(): Uint8Array[] {
  return Array(36).fill(new Uint8Array(16).fill(0x00));
}

describe('encodeRawBlocks / decodeRawBlocks', () => {
  it('roundtrips blocks through base64 encoding', () => {
    const blocks = [
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
      new Uint8Array([0xff, 0x00, 0xab, 0xcd, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    ];

    const encoded = encodeRawBlocks(blocks);
    expect(typeof encoded).toBe('string');

    const decoded = decodeRawBlocks(encoded);
    expect(decoded).toHaveLength(2);
    expect(Array.from(decoded[0])).toEqual(Array.from(blocks[0]));
    expect(Array.from(decoded[1])).toEqual(Array.from(blocks[1]));
  });

  it('handles empty blocks array', () => {
    const encoded = encodeRawBlocks([]);
    const decoded = decodeRawBlocks(encoded);
    expect(decoded).toHaveLength(0);
  });

  it('handles single block', () => {
    const block = new Uint8Array(16).fill(0x42);
    const encoded = encodeRawBlocks([block]);
    const decoded = decodeRawBlocks(encoded);
    expect(decoded).toHaveLength(1);
    expect(Array.from(decoded[0])).toEqual(Array.from(block));
  });
});

describe('reparseFromRawData', () => {
  it('re-parses a known valid reading from encoded raw data', () => {
    const padding = makePadding();
    const record = makeRecordBlock({
      counter: 0x79,
      sys: 117,
      dia: 70,
      hr: 70,
      year: 2026,
      month: 3,
      day: 17,
      hour: 14,
      minute: 38,
      second: 21,
    });

    const encoded = encodeRawBlocks([...padding, record]);
    const readings = reparseFromRawData(encoded);

    expect(readings.length).toBeGreaterThanOrEqual(1);
    const r = readings.find((r) => r.systolic === 117);
    expect(r).toBeDefined();
    expect(r!.diastolic).toBe(70);
    expect(r!.heartRate).toBe(70);
    expect(r!.timestamp.getFullYear()).toBe(2026);
    expect(r!.timestamp.getMonth()).toBe(2); // March = 2 (0-indexed)
    expect(r!.timestamp.getDate()).toBe(17);
  });

  it('re-parses multiple readings', () => {
    const padding = makePadding();
    const r1 = makeRecordBlock({
      counter: 1,
      sys: 120,
      dia: 80,
      hr: 72,
      year: 2026,
      month: 3,
      day: 15,
      hour: 9,
      minute: 30,
    });
    const r2 = makeRecordBlock({
      counter: 2,
      sys: 135,
      dia: 90,
      hr: 68,
      year: 2026,
      month: 3,
      day: 16,
      hour: 10,
      minute: 15,
    });

    const encoded = encodeRawBlocks([...padding, r1, r2]);
    const readings = reparseFromRawData(encoded);

    expect(readings).toHaveLength(2);
    expect(readings[0].systolic).toBe(120);
    expect(readings[1].systolic).toBe(135);
  });

  it('returns empty array for all-empty EEPROM', () => {
    const emptyBlocks = Array(60).fill(new Uint8Array(16).fill(0xff));
    const encoded = encodeRawBlocks(emptyBlocks);
    const readings = reparseFromRawData(encoded);
    expect(readings).toHaveLength(0);
  });

  it('skips readings with unset clock (year 0x15 = 2021)', () => {
    const padding = makePadding();
    const record = makeRecordBlock({
      counter: 1,
      sys: 120,
      dia: 80,
      hr: 72,
      year: 2021, // 0x15 — clock not set
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
    });

    const encoded = encodeRawBlocks([...padding, record]);
    const readings = reparseFromRawData(encoded);
    expect(readings).toHaveLength(0);
  });

  it('skips readings with year outside 2024-2035 range', () => {
    const padding = makePadding();
    const record = makeRecordBlock({
      counter: 1,
      sys: 120,
      dia: 80,
      hr: 72,
      year: 2010, // too old
      month: 6,
      day: 15,
      hour: 12,
      minute: 30,
    });

    const encoded = encodeRawBlocks([...padding, record]);
    const readings = reparseFromRawData(encoded);
    expect(readings).toHaveLength(0);
  });
});

describe('hexDumpRawData', () => {
  it('returns formatted hex lines with addresses', () => {
    const blocks = [
      new Uint8Array([0x79, 0x00, 0x4f, 0xb0, 0x5c, 0x46, 0x46, 0x1a, 0x2e, 0x0e, 0x95, 0x19, 0x80, 0x01, 0x00, 0x00]),
    ];
    const encoded = encodeRawBlocks(blocks);
    const lines = hexDumpRawData(encoded);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^0x0000:/);
    expect(lines[0]).toContain('79');
    expect(lines[0]).toContain('4f');
  });

  it('increments addresses for multiple blocks', () => {
    const blocks = [
      new Uint8Array(16).fill(0xaa),
      new Uint8Array(16).fill(0xbb),
      new Uint8Array(16).fill(0xcc),
    ];
    const encoded = encodeRawBlocks(blocks);
    const lines = hexDumpRawData(encoded);

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^0x0000:/);
    expect(lines[1]).toMatch(/^0x0010:/);
    expect(lines[2]).toMatch(/^0x0020:/);
  });
});

describe('debugParseReport', () => {
  it('returns structured report with block count, readings, and hex dump', () => {
    const padding = makePadding();
    const record = makeRecordBlock({
      counter: 5,
      sys: 130,
      dia: 85,
      hr: 75,
      year: 2026,
      month: 3,
      day: 20,
      hour: 8,
      minute: 45,
      second: 10,
    });

    const encoded = encodeRawBlocks([...padding, record]);
    const report = debugParseReport(encoded);

    expect(report.totalBlocks).toBe(37); // 36 padding + 1 record
    expect(report.totalBytes).toBe(37 * 16);
    expect(report.readings).toHaveLength(1);
    expect(report.readings[0].systolic).toBe(130);
    expect(report.readings[0].diastolic).toBe(85);
    expect(report.readings[0].heartRate).toBe(75);
    expect(report.readings[0].counter).toBe(5);
    expect(report.readings[0].timestamp).toContain('2026');
    expect(report.hexDump.length).toBe(37);
  });

  it('works with empty EEPROM', () => {
    const blocks = Array(60).fill(new Uint8Array(16).fill(0xff));
    const encoded = encodeRawBlocks(blocks);
    const report = debugParseReport(encoded);

    expect(report.totalBlocks).toBe(60);
    expect(report.readings).toHaveLength(0);
    expect(report.hexDump).toHaveLength(60);
  });
});

describe('real-world edge cases', () => {
  it('handles record spanning two blocks', () => {
    // Records are 14 bytes but blocks are 16 bytes, so records
    // can span block boundaries in the concatenated buffer.
    const padding = makePadding();

    // Put part of a record at the end of one block and start of the next
    const block1 = new Uint8Array(16);
    // Last 14 bytes form a valid record
    block1[2] = 0x01; // counter at offset 2
    block1[3] = 0x00; // delimiter
    block1[4] = 0x4f;
    block1[5] = 0xb0;
    block1[6] = 120 - 25; // SYS_raw
    block1[7] = 80; // DIA
    block1[8] = 72; // HR
    block1[9] = 26; // year 2026
    block1[10] = 30; // minute
    block1[11] = 10; // hour
    block1[12] = (2 << 6) | 15; // month=3, second=15
    block1[13] = 20; // day
    block1[14] = 0x80;
    block1[15] = 0x01;

    const encoded = encodeRawBlocks([...padding, block1]);
    const readings = reparseFromRawData(encoded);

    // Should find the record even though it doesn't start at offset 0 in the block
    const found = readings.find((r) => r.systolic === 120 && r.diastolic === 80);
    expect(found).toBeDefined();
  });

  it('deduplicates identical readings by counter+values', () => {
    const padding = makePadding();
    const record = makeRecordBlock({
      counter: 10,
      sys: 125,
      dia: 82,
      hr: 68,
      year: 2026,
      month: 3,
      day: 18,
      hour: 14,
      minute: 0,
    });

    // Same record appearing twice
    const encoded = encodeRawBlocks([...padding, record, record]);
    const readings = reparseFromRawData(encoded);

    // Should only get one reading due to dedup
    const matches = readings.filter((r) => r.systolic === 125 && r.diastolic === 82);
    expect(matches).toHaveLength(1);
  });

  it('filters stale readings with distant counters', () => {
    const padding = makePadding();
    // Main group: counters 10, 11, 12
    const r1 = makeRecordBlock({ counter: 10, sys: 120, dia: 80, hr: 70, year: 2026, month: 3, day: 15, hour: 9, minute: 0 });
    const r2 = makeRecordBlock({ counter: 11, sys: 125, dia: 82, hr: 72, year: 2026, month: 3, day: 16, hour: 10, minute: 0 });
    const r3 = makeRecordBlock({ counter: 12, sys: 130, dia: 85, hr: 74, year: 2026, month: 3, day: 17, hour: 11, minute: 0 });
    // Stale reading: counter 50 (far from main group)
    const stale = makeRecordBlock({ counter: 50, sys: 140, dia: 90, hr: 80, year: 2025, month: 1, day: 1, hour: 12, minute: 0 });

    const encoded = encodeRawBlocks([...padding, r1, r2, r3, stale]);
    const readings = reparseFromRawData(encoded);

    // Stale reading should be filtered out
    expect(readings).toHaveLength(3);
    expect(readings.find((r) => r.counter === 50)).toBeUndefined();
  });
});
