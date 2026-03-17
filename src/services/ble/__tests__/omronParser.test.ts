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
  it('finds the known 117/70/70 reading in raw block data', () => {
    // Record from real device with valid timestamp (2026-03-17 14:38:21):
    // 79 00 4f b0 5c 46 46 1a 2e 0e 95 19 80 01
    // SYS_raw=0x5C=92, +25=117; DIA=0x46=70; HR=0x46=70
    // year=0x1a=26, minute=0x2e&0xF7=0x26=38, hour=0x0e=14
    // month=(0x95>>6)+1=3, day=0x19&0xF7=0x11=17, second=0x95&0x3F=21
    const block = new Uint8Array([
      0x79, 0x00, 0x4f, 0xb0, 0x5c, 0x46, 0x46, 0x1a,
      0x2e, 0x0e, 0x95, 0x19, 0x80, 0x01, 0x00, 0x00,
    ]);

    // Pad with enough empty blocks before to pass the RECORD_AREA_START threshold
    const padding = Array(36).fill(new Uint8Array(16).fill(0x00));
    const results = parseAllRecords([...padding, block]);

    expect(results.length).toBeGreaterThanOrEqual(1);
    const reading = results.find(r => r.systolic === 117 && r.diastolic === 70);
    expect(reading).toBeDefined();
    expect(reading!.systolic).toBe(117);
    expect(reading!.diastolic).toBe(70);
    expect(reading!.heartRate).toBe(70);
    // Verify decoded timestamp: 2026-03-17 14:38:21
    expect(reading!.timestamp.getFullYear()).toBe(2026);
    expect(reading!.timestamp.getMonth()).toBe(2); // 0-indexed March
    expect(reading!.timestamp.getDate()).toBe(17);
    expect(reading!.timestamp.getHours()).toBe(14);
    expect(reading!.timestamp.getMinutes()).toBe(38);
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
