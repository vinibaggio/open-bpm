import { parseReadingsCsv } from '../csvImport';

describe('parseReadingsCsv', () => {
  it('parses valid CSV with all fields', () => {
    const csv = [
      'Date (YYYY-MM-DD),Time (24h HH:MM:SS),Systolic,Diastolic,HeartRate,Manual/BLE,Notes',
      '2026-03-17,14:38:42,117,70,70,ble,',
      '2026-03-18,09:15:00,125,82,72,manual,"after coffee"',
    ].join('\n');

    const result = parseReadingsCsv(csv);

    expect(result.invalidCount).toBe(0);
    expect(result.readings).toHaveLength(2);

    expect(result.readings[0]).toEqual({
      systolic: 117,
      diastolic: 70,
      heartRate: 70,
      timestamp: new Date(2026, 2, 17, 14, 38, 42).toISOString(),
      notes: null,
      source: 'ble',
    });

    expect(result.readings[1]).toEqual({
      systolic: 125,
      diastolic: 82,
      heartRate: 72,
      timestamp: new Date(2026, 2, 18, 9, 15, 0).toISOString(),
      notes: 'after coffee',
      source: 'manual',
    });
  });
});
