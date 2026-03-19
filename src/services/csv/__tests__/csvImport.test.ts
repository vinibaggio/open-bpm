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

  it('handles empty HeartRate as null', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,117,70,,ble,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings[0].heartRate).toBeNull();
  });

  it('handles quoted notes with commas and escaped quotes', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,117,70,70,manual,"took meds, felt ""dizzy"""',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings[0].notes).toBe('took meds, felt "dizzy"');
  });

  it('rejects out-of-range systolic', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,50,70,70,manual,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(0);
    expect(result.invalidCount).toBe(1);
  });

  it('rejects out-of-range diastolic', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,120,210,70,manual,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(0);
    expect(result.invalidCount).toBe(1);
  });

  it('rejects out-of-range heart rate', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,120,80,300,manual,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(0);
    expect(result.invalidCount).toBe(1);
  });

  it('rejects rows where diastolic >= systolic', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,80,90,70,manual,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(0);
    expect(result.invalidCount).toBe(1);
  });

  it('rejects unparseable dates', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      'not-a-date,14:38:00,120,80,70,manual,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(0);
    expect(result.invalidCount).toBe(1);
  });

  it('returns correct invalidCount with mixed valid and invalid rows', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,120,80,70,manual,',
      'bad-date,14:38:00,120,80,70,manual,',
      '2026-03-18,09:00:00,130,85,,ble,',
      '2026-03-19,10:00:00,50,80,70,manual,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(2);
    expect(result.invalidCount).toBe(2);
  });

  it('accepts old header format (by position)', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38,120,80,70,manual,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(1);
    expect(result.readings[0].timestamp).toBe(
      new Date(2026, 2, 17, 14, 38, 0).toISOString()
    );
  });

  it('handles empty file gracefully', () => {
    const result = parseReadingsCsv('');
    expect(result.readings).toHaveLength(0);
    expect(result.invalidCount).toBe(0);
  });

  it('handles header-only file gracefully', () => {
    const csv = 'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes\n';
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(0);
    expect(result.invalidCount).toBe(0);
  });

  it('rejects file with insufficient columns (no valid header)', () => {
    const csv = 'Name,Value\nfoo,bar\n';
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(0);
  });

  it('strips UTF-8 BOM', () => {
    const csv = '\uFEFFDate,Time,Systolic,Diastolic,HeartRate,Source,Notes\n2026-03-17,14:38:00,120,80,70,manual,';
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(1);
  });

  it('handles \\r\\n line endings', () => {
    const csv = 'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes\r\n2026-03-17,14:38:00,120,80,70,manual,';
    const result = parseReadingsCsv(csv);
    expect(result.readings).toHaveLength(1);
  });

  it('defaults invalid source to manual', () => {
    const csv = [
      'Date,Time,Systolic,Diastolic,HeartRate,Source,Notes',
      '2026-03-17,14:38:00,120,80,70,unknown,',
    ].join('\n');
    const result = parseReadingsCsv(csv);
    expect(result.readings[0].source).toBe('manual');
  });
});
