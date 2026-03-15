import { Reading } from '../../types/reading';
import { classifyBP, BPCategory, BP_COLORS } from '../../utils/bloodPressure';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function generateReportHtml(
  readings: Reading[],
  startDate: string,
  endDate: string
): string {
  const rows = readings
    .map((r) => {
      const category = classifyBP(r.systolic, r.diastolic);
      const isAbnormal = category !== BPCategory.Normal;
      const bgColor = isAbnormal ? BP_COLORS[category] : 'transparent';
      const textColor = isAbnormal ? '#FFFFFF' : '#000000';
      return `
        <tr style="background-color: ${bgColor}; color: ${textColor};">
          <td>${formatDate(r.timestamp)}</td>
          <td>${formatTime(r.timestamp)}</td>
          <td>${r.systolic}</td>
          <td>${r.diastolic}</td>
          <td>${r.heartRate ?? '—'}</td>
        </tr>`;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 20px; }
        h1 { font-size: 20px; }
        p { font-size: 14px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background-color: #f5f5f5; font-weight: 600; }
        .footer { margin-top: 24px; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <h1>Blood Pressure Report</h1>
      <p>${startDate} — ${endDate}</p>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Systolic</th>
            <th>Diastolic</th>
            <th>Heart Rate</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p class="footer">Generated on ${new Date().toLocaleDateString()}</p>
    </body>
    </html>
  `;
}
