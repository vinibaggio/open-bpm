import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@saved_device';

export interface SavedDevice {
  id: string;
  name: string;
  lastSyncDate: string | null;
}

export async function getSavedDevice(): Promise<SavedDevice | null> {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  if (!json) return null;
  return JSON.parse(json) as SavedDevice;
}

export async function saveDevice(id: string, name: string): Promise<void> {
  const device: SavedDevice = { id, name, lastSyncDate: null };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(device));
}

export async function forgetDevice(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function updateLastSyncDate(): Promise<void> {
  const device = await getSavedDevice();
  if (!device) return;
  device.lastSyncDate = new Date().toISOString();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(device));
}
