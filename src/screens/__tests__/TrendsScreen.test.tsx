jest.mock('victory-native', () => ({
  CartesianChart: 'CartesianChart',
  Line: 'Line',
  Scatter: 'Scatter',
  Area: 'Area',
}));

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: jest.fn(() => ({ navigate: jest.fn() })),
}));
jest.mock('../../services/database/readingRepository', () => ({
  getAllReadings: jest.fn(),
  getReadingsByDateRange: jest.fn(),
}));
jest.mock('../../services/report/reportHtml', () => ({
  generateReportHtml: jest.fn(),
}));

import { computeStats } from '../TrendsScreen';
import { Reading } from '../../types/reading';

function makeReading(sys: number, dia: number, hr: number | null): Reading {
  return {
    id: String(Math.random()),
    systolic: sys,
    diastolic: dia,
    heartRate: hr,
    timestamp: new Date().toISOString(),
    notes: null,
    source: 'manual',
  };
}

describe('computeStats', () => {
  it('returns zeroed stats for empty readings', () => {
    const stats = computeStats([]);
    expect(stats.avgSystolic).toBe(0);
    expect(stats.avgDiastolic).toBe(0);
    expect(stats.avgHR).toBe(0);
    expect(stats.highestSystolic).toBe(0);
    expect(stats.highestDiastolic).toBe(0);
    expect(stats.count).toBe(0);
  });

  it('computes correct averages and highest', () => {
    const readings = [
      makeReading(120, 80, 70),
      makeReading(140, 90, 80),
      makeReading(130, 85, null),
    ];
    const stats = computeStats(readings);
    expect(stats.avgSystolic).toBe(130);
    expect(stats.avgDiastolic).toBe(85);
    expect(stats.avgHR).toBe(75);
    expect(stats.highestSystolic).toBe(140);
    expect(stats.highestDiastolic).toBe(90);
    expect(stats.count).toBe(3);
  });

  it('handles all null heart rates', () => {
    const readings = [makeReading(120, 80, null)];
    const stats = computeStats(readings);
    expect(stats.avgHR).toBe(0);
  });
});
