import { generateReportHtml } from '../reportHtml';
import { Reading } from '../../../types/reading';

describe('generateReportHtml', () => {
  const readings: Reading[] = [
    {
      id: '1',
      systolic: 118,
      diastolic: 76,
      heartRate: 72,
      timestamp: '2026-03-14T10:00:00Z',
      notes: null,
      sourceImageUri: null,
    },
    {
      id: '2',
      systolic: 145,
      diastolic: 92,
      heartRate: 80,
      timestamp: '2026-03-13T09:00:00Z',
      notes: null,
      sourceImageUri: null,
    },
  ];

  it('generates HTML with a table', () => {
    const html = generateReportHtml(readings, '2026-03-01', '2026-03-14');
    expect(html).toContain('<table');
    expect(html).toContain('118');
    expect(html).toContain('76');
  });

  it('includes the date range in the header', () => {
    const html = generateReportHtml(readings, '2026-03-01', '2026-03-14');
    expect(html).toContain('2026-03-01');
    expect(html).toContain('2026-03-14');
  });

  it('highlights abnormal readings with red styling', () => {
    const html = generateReportHtml(readings, '2026-03-01', '2026-03-14');
    // 145/92 is High Stage 2 — should be highlighted with #F44336
    expect(html).toContain('#F44336');
  });

  it('shows heart rate column', () => {
    const html = generateReportHtml(readings, '2026-03-01', '2026-03-14');
    expect(html).toContain('Heart Rate');
    expect(html).toContain('72');
  });
});
