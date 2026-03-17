import {
  getSavedDevice,
  saveDevice,
  forgetDevice,
  updateLastSyncDate,
  SavedDevice,
} from '../deviceStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('deviceStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSavedDevice', () => {
    it('returns null when no device is saved', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      const result = await getSavedDevice();
      expect(result).toBeNull();
    });

    it('returns parsed device when saved', async () => {
      const device: SavedDevice = {
        id: 'abc-123',
        name: 'Omron BP7150',
        lastSyncDate: '2026-03-15T10:00:00.000Z',
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(device));
      const result = await getSavedDevice();
      expect(result).toEqual(device);
    });
  });

  describe('saveDevice', () => {
    it('persists device to storage', async () => {
      await saveDevice('abc-123', 'Omron BP7150');
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@saved_device',
        expect.stringContaining('"id":"abc-123"')
      );
    });
  });

  describe('forgetDevice', () => {
    it('removes device from storage', async () => {
      await forgetDevice();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@saved_device');
    });
  });

  describe('updateLastSyncDate', () => {
    it('updates lastSyncDate on existing device', async () => {
      const device: SavedDevice = {
        id: 'abc-123',
        name: 'Omron BP7150',
        lastSyncDate: null,
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(device));
      await updateLastSyncDate();
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@saved_device',
        expect.stringContaining('"id":"abc-123"')
      );
    });

    it('does nothing when no device is saved', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      await updateLastSyncDate();
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });
});
