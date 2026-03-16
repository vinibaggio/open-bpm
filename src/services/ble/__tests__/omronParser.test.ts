import { parseAllRecords, isEmptyRecord } from '../omronParser';

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

describe('parseAllRecords', () => {
  it('finds the known 120/69/59 reading in raw block data', () => {
    // Block #42 from real device: contains our known reading at offset 0
    // Record: 77 00 c6 39 5f 45 3b 15 20 04 3f 20 80 00 78 00
    // SYS_raw=0x5F=95, +25=120; DIA=0x45=69; HR=0x3B=59
    const block = new Uint8Array([
      0x77, 0x00, 0xc6, 0x39, 0x5f, 0x45, 0x3b, 0x15,
      0x20, 0x04, 0x3f, 0x20, 0x80, 0x00, 0x78, 0x00,
    ]);

    // Pad with enough empty blocks before to pass the RECORD_AREA_START threshold
    const padding = Array(36).fill(new Uint8Array(16).fill(0x00));
    const results = parseAllRecords([...padding, block]);

    expect(results.length).toBeGreaterThanOrEqual(1);
    const reading = results.find(r => r.systolic === 120 && r.diastolic === 69);
    expect(reading).toBeDefined();
    expect(reading!.systolic).toBe(120);
    expect(reading!.diastolic).toBe(69);
    expect(reading!.heartRate).toBe(59);
  });

  it('skips all-0xFF blocks', () => {
    const emptyBlocks = Array(60).fill(new Uint8Array(16).fill(0xff));
    const results = parseAllRecords(emptyBlocks);
    expect(results.length).toBe(0);
  });

  it('validates BP ranges', () => {
    // Create a block with values outside valid BP range
    const padding = Array(36).fill(new Uint8Array(16).fill(0x00));
    const badBlock = new Uint8Array([
      0x01, 0x00, 0x00, 0x00, 0x00, 0x05, 0x05, 0x00, // SYS=25 (too low), DIA=5 (too low)
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const results = parseAllRecords([...padding, badBlock]);
    expect(results.length).toBe(0);
  });
});
