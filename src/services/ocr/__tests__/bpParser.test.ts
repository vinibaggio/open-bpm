import { parseBPFromText } from '../bpParser';

describe('parseBPFromText', () => {
  it('extracts three numbers as systolic, diastolic, heartRate', () => {
    const result = parseBPFromText(['120', '80', '72']);
    expect(result).toEqual({ systolic: 120, diastolic: 80, heartRate: 72 });
  });

  it('extracts two numbers as systolic, diastolic', () => {
    const result = parseBPFromText(['130', '85']);
    expect(result).toEqual({ systolic: 130, diastolic: 85, heartRate: null });
  });

  it('extracts numbers from mixed text', () => {
    const result = parseBPFromText(['SYS 120', 'DIA 80', 'PUL 72']);
    expect(result).toEqual({ systolic: 120, diastolic: 80, heartRate: 72 });
  });

  it('extracts numbers from a single string with slashes', () => {
    const result = parseBPFromText(['120/80']);
    expect(result).toEqual({ systolic: 120, diastolic: 80, heartRate: null });
  });

  it('returns null when fewer than 2 numbers found', () => {
    const result = parseBPFromText(['hello']);
    expect(result).toBeNull();
  });

  it('filters out unreasonable BP values', () => {
    const result = parseBPFromText(['2026', '120', '80', '72']);
    expect(result).toEqual({ systolic: 120, diastolic: 80, heartRate: 72 });
  });

  it('handles numbers embedded in longer text', () => {
    const result = parseBPFromText(['Blood Pressure: 135/88 Pulse: 65']);
    expect(result).toEqual({ systolic: 135, diastolic: 88, heartRate: 65 });
  });
});
