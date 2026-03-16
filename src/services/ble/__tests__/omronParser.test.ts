import { parseRecord, isEmptyRecord } from '../omronParser';

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

function buildRecord(fields: {
  minute?: number;
  second?: number;
  movement?: number;
  irregular?: number;
  month?: number;
  day?: number;
  hour?: number;
  year?: number;
  pulse?: number;
  diastolic?: number;
  systolicRaw?: number;
}): Uint8Array {
  let bigint = BigInt(0);
  function setBits(value: number, startBit: number, width: number) {
    bigint |= BigInt(value & ((1 << width) - 1)) << BigInt(startBit);
  }
  setBits(fields.minute ?? 0, 68, 6);
  setBits(fields.second ?? 0, 74, 6);
  setBits(fields.movement ?? 0, 80, 1);
  setBits(fields.irregular ?? 0, 81, 1);
  setBits(fields.month ?? 1, 82, 4);
  setBits(fields.day ?? 1, 86, 5);
  setBits(fields.hour ?? 0, 91, 5);
  setBits(fields.year ?? 26, 98, 6);
  setBits(fields.pulse ?? 60, 104, 8);
  setBits(fields.diastolic ?? 70, 112, 8);
  setBits(fields.systolicRaw ?? 95, 120, 8);

  const record = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    record[i] = Number((bigint >> BigInt(i * 8)) & BigInt(0xff));
  }
  return record;
}

describe('parseRecord', () => {
  it('parses a known record correctly', () => {
    const record = buildRecord({
      minute: 30, second: 45, month: 3, day: 14, hour: 10,
      year: 26, pulse: 59, diastolic: 69, systolicRaw: 95, // 95 + 25 = 120
    });

    const result = parseRecord(record);
    expect(result).not.toBeNull();
    expect(result!.systolic).toBe(120);
    expect(result!.diastolic).toBe(69);
    expect(result!.heartRate).toBe(59);
    expect(result!.timestamp.getFullYear()).toBe(2026);
    expect(result!.timestamp.getMonth()).toBe(2); // March = 2
    expect(result!.timestamp.getDate()).toBe(14);
    expect(result!.timestamp.getHours()).toBe(10);
    expect(result!.timestamp.getMinutes()).toBe(30);
    expect(result!.timestamp.getSeconds()).toBe(45);
    expect(result!.irregularHeartbeat).toBe(false);
    expect(result!.movementDetected).toBe(false);
  });

  it('adds 25 to systolic value', () => {
    const record = buildRecord({ systolicRaw: 0, diastolic: 40 });
    const result = parseRecord(record);
    expect(result!.systolic).toBe(25);
  });

  it('clamps seconds to max 59', () => {
    const record = buildRecord({ second: 63 });
    const result = parseRecord(record);
    expect(result!.timestamp.getSeconds()).toBe(59);
  });

  it('detects irregular heartbeat flag', () => {
    const record = buildRecord({ irregular: 1 });
    const result = parseRecord(record);
    expect(result!.irregularHeartbeat).toBe(true);
  });

  it('detects movement flag', () => {
    const record = buildRecord({ movement: 1 });
    const result = parseRecord(record);
    expect(result!.movementDetected).toBe(true);
  });

  it('returns null for invalid month', () => {
    const record = buildRecord({ month: 0 });
    const result = parseRecord(record);
    expect(result).toBeNull();
  });
});
