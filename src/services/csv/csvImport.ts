import { Reading } from '../../types/reading';

export type ParsedReading = Omit<Reading, 'id'>;

export interface ParseResult {
  readings: ParsedReading[];
  invalidCount: number;
}

function parseFields(line: string): string[] {
  const fields: string[] = [];
  let i = 0;

  while (i < line.length) {
    if (line[i] === '"') {
      let value = '';
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      fields.push(value);
      if (i < line.length && line[i] === ',') i++;
    } else {
      const commaIdx = line.indexOf(',', i);
      if (commaIdx === -1) {
        fields.push(line.substring(i));
        break;
      } else {
        fields.push(line.substring(i, commaIdx));
        i = commaIdx + 1;
        if (i === line.length) {
          fields.push('');
        }
      }
    }
  }

  return fields;
}

function parseRow(fields: string[]): ParsedReading | null {
  if (fields.length < 7) return null;

  const [dateStr, timeStr, sysStr, diaStr, hrStr, sourceStr, ...notesParts] = fields;

  const systolic = parseInt(sysStr, 10);
  const diastolic = parseInt(diaStr, 10);
  if (isNaN(systolic) || isNaN(diastolic)) return null;

  if (systolic < 60 || systolic > 300) return null;
  if (diastolic < 30 || diastolic > 200) return null;
  if (diastolic >= systolic) return null;

  let heartRate: number | null = null;
  if (hrStr.trim() !== '') {
    heartRate = parseInt(hrStr, 10);
    if (isNaN(heartRate) || heartRate < 30 || heartRate > 250) return null;
  }

  const timeParts = timeStr.split(':');
  if (timeParts.length < 2) return null;
  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);
  const second = timeParts.length >= 3 ? parseInt(timeParts[2], 10) : 0;

  const dateParts = dateStr.split('-');
  if (dateParts.length !== 3) return null;
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);

  const date = new Date(year, month, day, hour, minute, second);
  if (isNaN(date.getTime())) return null;

  const sourceLower = sourceStr.trim().toLowerCase();
  const source: 'manual' | 'ble' = sourceLower === 'ble' ? 'ble' : 'manual';

  const notesRaw = notesParts.join(',').trim();
  const notes = notesRaw === '' ? null : notesRaw;

  return {
    systolic,
    diastolic,
    heartRate,
    timestamp: date.toISOString(),
    notes,
    source,
    rawData: null,
  };
}

export function parseReadingsCsv(content: string): ParseResult {
  const cleaned = content.replace(/^\uFEFF/, '');
  const lines = cleaned.replace(/\r\n/g, '\n').split('\n');

  if (lines.length === 0) return { readings: [], invalidCount: 0 };

  const headerFields = parseFields(lines[0]);
  if (headerFields.length < 7) return { readings: [], invalidCount: 0 };

  const readings: ParsedReading[] = [];
  let invalidCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;

    const fields = parseFields(line);
    const reading = parseRow(fields);
    if (reading) {
      readings.push(reading);
    } else {
      invalidCount++;
    }
  }

  return { readings, invalidCount };
}
