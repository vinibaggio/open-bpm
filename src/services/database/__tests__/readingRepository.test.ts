import { addReading, getAllReadings, getReadingsByDateRange, deleteReading } from '../readingRepository';
import { Reading } from '../../../types/reading';

jest.mock('../db', () => {
  const mockDb = {
    runAsync: jest.fn(),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn(),
  };
  return {
    getDatabase: jest.fn().mockResolvedValue(mockDb),
    __mockDb: mockDb,
  };
});

const { __mockDb: mockDb } = require('../db');

describe('readingRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('addReading inserts a reading into the database', async () => {
    const reading: Reading = {
      id: 'test-id',
      systolic: 120,
      diastolic: 80,
      heartRate: 72,
      timestamp: '2026-03-14T10:00:00Z',
      notes: null,
      source: 'manual',
      rawData: null,
    };
    await addReading(reading);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO readings'),
      expect.arrayContaining(['test-id', 120, 80, 72])
    );
  });

  it('getAllReadings returns readings ordered by timestamp desc', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      { id: '1', systolic: 120, diastolic: 80, heartRate: 72, timestamp: '2026-03-14T10:00:00Z', notes: null, source: 'manual', rawData: null },
    ]);
    const readings = await getAllReadings();
    expect(readings).toHaveLength(1);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY timestamp DESC')
    );
  });

  it('deleteReading removes a reading by id', async () => {
    await deleteReading('test-id');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM readings'),
      expect.arrayContaining(['test-id'])
    );
  });
});
