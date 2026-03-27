import { parseAllRecords, isEmptyRecord } from '../omronParser';
import { EEPROM_HEX_BLOCKS, hexToBlocks } from './fixtures/eepromDump';

describe('isEmptyRecord', () => {
  it('returns true for all-0xFF record', () => {
    const record = new Uint8Array(16).fill(0xff);
    expect(isEmptyRecord(record)).toBe(true);
  });

  it('returns false for a record with data', () => {
    const record = new Uint8Array(16).fill(0x00);
    expect(isEmptyRecord(record)).toBe(false);
  });
});

/**
 * Helper: build a 960-byte buffer (60 × 16-byte blocks) with records placed
 * at the correct byte offsets. Records are 14 bytes each; the scanner finds
 * them by pattern-matching within the concatenated buffer.
 *
 * The RECORD_AREA_START in the parser is 576, so we pad with zeros before that.
 */
function buildBufferWithRecords(records: Uint8Array[]): Uint8Array[] {
  // Build a flat buffer, pad to at least 576 + space for records
  const totalSize = 576 + records.length * 14 + 16; // extra padding
  const buffer = new Uint8Array(totalSize).fill(0xff);

  // Place records starting at offset 576 (RECORD_AREA_START)
  let offset = 576;
  for (const rec of records) {
    buffer.set(rec, offset);
    offset += 14;
  }

  // Split into 16-byte blocks for parseAllRecords
  const blocks: Uint8Array[] = [];
  for (let i = 0; i < buffer.length; i += 16) {
    blocks.push(buffer.slice(i, i + 16));
  }
  return blocks;
}

describe('parseAllRecords', () => {
  // These three readings were cross-validated against the Omron Connect app.
  // Raw 14-byte records captured from a real BP7150 (HEM-7150T) via BLE.

  // Reading 1: 117/70 HR=70, March 17, 2026 14:38:21
  const RECORD_79 = new Uint8Array([
    0x79, 0x00, 0x4f, 0xb0, 0x5c, 0x46, 0x46, 0x1a,
    0x2e, 0x0e, 0x95, 0x19, 0x80, 0x01,
  ]);

  // Reading 2: 117/70 HR=59, March 17, 2026 22:17:07
  const RECORD_7A = new Uint8Array([
    0x7a, 0x00, 0xe7, 0x18, 0x5c, 0x46, 0x3b, 0x1a,
    0x36, 0x0e, 0x47, 0x14, 0x80, 0x00,
  ]);

  // Reading 3: 118/68 HR=65, March 27, 2026 14:39:47
  const RECORD_7B = new Uint8Array([
    0x7b, 0x00, 0x91, 0x6e, 0x5d, 0x44, 0x41, 0x1a,
    0x6e, 0x0f, 0xef, 0x19, 0x80, 0x00,
  ]);

  it('correctly parses 117/70 HR=70 reading from March 17, 2026 14:38', () => {
    const blocks = buildBufferWithRecords([RECORD_79]);
    const results = parseAllRecords(blocks);

    expect(results.length).toBe(1);
    const r = results[0];
    expect(r.systolic).toBe(117);
    expect(r.diastolic).toBe(70);
    expect(r.heartRate).toBe(70);
    expect(r.counter).toBe(0x79);
    expect(r.timestamp.getFullYear()).toBe(2026);
    expect(r.timestamp.getMonth()).toBe(2); // 0-indexed: March
    expect(r.timestamp.getDate()).toBe(17);
    expect(r.timestamp.getHours()).toBe(14);
    expect(r.timestamp.getMinutes()).toBe(38);
    expect(r.timestamp.getSeconds()).toBe(21);
  });

  it('correctly parses 117/70 HR=59 reading from March 17, 2026 22:17', () => {
    const blocks = buildBufferWithRecords([RECORD_7A]);
    const results = parseAllRecords(blocks);

    expect(results.length).toBe(1);
    const r = results[0];
    expect(r.systolic).toBe(117);
    expect(r.diastolic).toBe(70);
    expect(r.heartRate).toBe(59);
    expect(r.counter).toBe(0x7a);
    expect(r.timestamp.getFullYear()).toBe(2026);
    expect(r.timestamp.getMonth()).toBe(2);
    expect(r.timestamp.getDate()).toBe(17);
    expect(r.timestamp.getHours()).toBe(22);
    expect(r.timestamp.getMinutes()).toBe(17);
    expect(r.timestamp.getSeconds()).toBe(7);
  });

  it('correctly parses 118/68 HR=65 reading from March 27, 2026 14:39', () => {
    const blocks = buildBufferWithRecords([RECORD_7B]);
    const results = parseAllRecords(blocks);

    expect(results.length).toBe(1);
    const r = results[0];
    expect(r.systolic).toBe(118);
    expect(r.diastolic).toBe(68);
    expect(r.heartRate).toBe(65);
    expect(r.counter).toBe(0x7b);
    expect(r.timestamp.getFullYear()).toBe(2026);
    expect(r.timestamp.getMonth()).toBe(2); // March
    expect(r.timestamp.getDate()).toBe(27);
    expect(r.timestamp.getHours()).toBe(14);
    expect(r.timestamp.getMinutes()).toBe(39);
    expect(r.timestamp.getSeconds()).toBe(47);
  });

  it('parses all three known readings together with correct timestamps', () => {
    const blocks = buildBufferWithRecords([RECORD_79, RECORD_7A, RECORD_7B]);
    const results = parseAllRecords(blocks);

    expect(results.length).toBe(3);

    // Verify all readings are present with correct values
    const r79 = results.find(r => r.counter === 0x79);
    const r7a = results.find(r => r.counter === 0x7a);
    const r7b = results.find(r => r.counter === 0x7b);

    expect(r79).toBeDefined();
    expect(r7a).toBeDefined();
    expect(r7b).toBeDefined();

    // Spot-check key fields
    expect(r79!.systolic).toBe(117);
    expect(r79!.timestamp.getDate()).toBe(17);

    expect(r7a!.systolic).toBe(117);
    expect(r7a!.timestamp.getHours()).toBe(22);

    expect(r7b!.systolic).toBe(118);
    expect(r7b!.timestamp.getDate()).toBe(27);
    expect(r7b!.timestamp.getMinutes()).toBe(39);
  });

  it('skips records with clock not set (year=2021 default)', () => {
    // Real "no clock" record: counter=0x74, SYS=119, DIA=75, HR=68
    // Timestamp bytes show year=0x15=21 (default unset value)
    const noClockRecord = new Uint8Array([
      0x74, 0x00, 0x6f, 0x90, 0x5e, 0x4b, 0x44, 0x15,
      0x20, 0x04, 0x3f, 0x10, 0x80, 0x00,
    ]);

    const blocks = buildBufferWithRecords([noClockRecord]);
    const results = parseAllRecords(blocks);
    expect(results.length).toBe(0);
  });

  it('skips all-0xFF blocks', () => {
    const emptyBlocks = Array(60).fill(new Uint8Array(16).fill(0xff));
    const results = parseAllRecords(emptyBlocks);
    expect(results.length).toBe(0);
  });

  it('validates BP ranges — rejects out-of-range values', () => {
    const badBlock = new Uint8Array([
      0x01, 0x00, 0x00, 0x00, 0x00, 0x05, 0x05, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const blocks = buildBufferWithRecords([badBlock]);
    const results = parseAllRecords(blocks);
    expect(results.length).toBe(0);
  });

  describe('full EEPROM dump from 2026-03-27', () => {
    // This uses a real 960-byte EEPROM capture from a BP7150.
    // Cross-validated against Omron Connect app.
    let results: ReturnType<typeof parseAllRecords>;

    beforeAll(() => {
      const blocks = hexToBlocks(EEPROM_HEX_BLOCKS);
      expect(blocks.length).toBe(60);
      results = parseAllRecords(blocks);
    });

    it('finds exactly 3 readings with valid timestamps', () => {
      expect(results.length).toBe(3);
    });

    it('parses 117/70 HR=70 @ 2026-03-17 14:38 (counter 0x79)', () => {
      const r = results.find(r => r.counter === 0x79);
      expect(r).toBeDefined();
      expect(r!.systolic).toBe(117);
      expect(r!.diastolic).toBe(70);
      expect(r!.heartRate).toBe(70);
      expect(r!.timestamp.getFullYear()).toBe(2026);
      expect(r!.timestamp.getMonth()).toBe(2); // March
      expect(r!.timestamp.getDate()).toBe(17);
      expect(r!.timestamp.getHours()).toBe(14);
      expect(r!.timestamp.getMinutes()).toBe(38);
    });

    it('parses 117/70 HR=59 @ 2026-03-17 22:17 (counter 0x7a)', () => {
      const r = results.find(r => r.counter === 0x7a);
      expect(r).toBeDefined();
      expect(r!.systolic).toBe(117);
      expect(r!.diastolic).toBe(70);
      expect(r!.heartRate).toBe(59);
      expect(r!.timestamp.getFullYear()).toBe(2026);
      expect(r!.timestamp.getMonth()).toBe(2);
      expect(r!.timestamp.getDate()).toBe(17);
      expect(r!.timestamp.getHours()).toBe(22);
      expect(r!.timestamp.getMinutes()).toBe(17);
    });

    it('parses 118/68 HR=65 @ 2026-03-27 14:39 (counter 0x7b)', () => {
      const r = results.find(r => r.counter === 0x7b);
      expect(r).toBeDefined();
      expect(r!.systolic).toBe(118);
      expect(r!.diastolic).toBe(68);
      expect(r!.heartRate).toBe(65);
      expect(r!.timestamp.getFullYear()).toBe(2026);
      expect(r!.timestamp.getMonth()).toBe(2);
      expect(r!.timestamp.getDate()).toBe(27);
      expect(r!.timestamp.getHours()).toBe(14);
      expect(r!.timestamp.getMinutes()).toBe(39);
    });

    it('skips all clock-not-set readings (year=2021)', () => {
      // Counters 0x74-0x78, 0x7c, 0x6f, 0x70 all have year=0x15 (2021)
      const noClockCounters = [0x74, 0x75, 0x76, 0x77, 0x78, 0x7c, 0x6f, 0x70];
      for (const c of noClockCounters) {
        expect(results.find(r => r.counter === c)).toBeUndefined();
      }
    });
  });
});
