import { BleManager, Device } from 'react-native-ble-plx';
import {
  OMRON_SERVICE_UUID,
  UNLOCK_CHAR_UUID,
  TX_CHAR_UUIDS,
  RX_CHAR_UUIDS,
  PAIRING_KEY,
  RECORD_START_ADDRESS,
  RECORDS_PER_USER,
  RECORD_SIZE,
  BLOCK_SIZE,
  OmronReading,
} from './types';
import {
  buildStartCommand,
  buildEndCommand,
  buildReadCommand,
  parseResponseType,
  extractResponseData,
  hexDump,
} from './omronProtocol';
import { parseRecord, isEmptyRecord, dumpRecord } from './omronParser';
import { addReading, readingExistsByTimestamp } from '../database/readingRepository';
import { Reading } from '../../types/reading';
import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values';

const manager = new BleManager();

type StatusCallback = (status: string) => void;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function waitForNotification(
  device: Device,
  charUuid: string,
  timeoutMs: number = 5000
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      subscription.remove();
      console.log(`[BLE:Sync] TIMEOUT waiting for notification on ${charUuid} (${timeoutMs}ms)`);
      reject(new Error('BLE notification timeout'));
    }, timeoutMs);

    const subscription = device.monitorCharacteristicForService(
      OMRON_SERVICE_UUID,
      charUuid,
      (error, char) => {
        clearTimeout(timer);
        subscription.remove();
        if (error) {
          console.log(`[BLE:Sync] Notification error on ${charUuid}: ${error.message}`);
          reject(error);
          return;
        }
        if (char?.value) {
          const data = base64ToUint8Array(char.value);
          console.log(hexDump(data, `NOTIFY ${charUuid.substring(0, 8)}`));
          resolve(data);
        } else {
          console.log(`[BLE:Sync] Empty notification on ${charUuid}`);
          reject(new Error('Empty notification'));
        }
      }
    );
  });
}

async function writeCharacteristic(
  device: Device,
  charUuid: string,
  data: Uint8Array
): Promise<void> {
  console.log(hexDump(data, `WRITE ${charUuid.substring(0, 8)}`));
  await device.writeCharacteristicWithResponseForService(
    OMRON_SERVICE_UUID,
    charUuid,
    uint8ArrayToBase64(data)
  );
}

async function sendCommand(device: Device, command: Uint8Array): Promise<Uint8Array> {
  // Set up RX notification listener before writing TX
  const responsePromise = waitForNotification(device, RX_CHAR_UUIDS[0]);

  // Write command to TX channel 0
  await writeCharacteristic(device, TX_CHAR_UUIDS[0], command);

  return responsePromise;
}

export async function scanForOmron(onStatus?: StatusCallback): Promise<Device> {
  onStatus?.('Scanning for Omron monitor...');
  console.log('[BLE:Sync] Starting scan for Omron service:', OMRON_SERVICE_UUID);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      manager.stopDeviceScan();
      console.log('[BLE:Sync] Scan timeout — no device found');
      reject(new Error('Could not find Omron monitor. Make sure it is nearby and turned on.'));
    }, 15000);

    manager.startDeviceScan(
      [OMRON_SERVICE_UUID],
      null,
      (error, device) => {
        if (error) {
          clearTimeout(timer);
          manager.stopDeviceScan();
          console.log('[BLE:Sync] Scan error:', error.message);
          reject(error);
          return;
        }
        if (device) {
          clearTimeout(timer);
          manager.stopDeviceScan();
          console.log(`[BLE:Sync] Found device: name=${device.name} id=${device.id} rssi=${device.rssi}`);
          onStatus?.(`Found: ${device.name || device.id}`);
          resolve(device);
        }
      }
    );
  });
}

export async function pairDevice(device: Device, onStatus?: StatusCallback): Promise<Device> {
  onStatus?.('Connecting...');
  console.log(`[BLE:Sync] Connecting to ${device.id}...`);
  const connected = await device.connect();
  console.log('[BLE:Sync] Connected, discovering services...');
  await connected.discoverAllServicesAndCharacteristics();

  // Log discovered services
  const services = await connected.services();
  console.log(`[BLE:Sync] Discovered ${services.length} services:`);
  for (const svc of services) {
    console.log(`[BLE:Sync]   Service: ${svc.uuid}`);
    const chars = await svc.characteristics();
    for (const ch of chars) {
      console.log(`[BLE:Sync]     Char: ${ch.uuid} (read=${ch.isReadable} write=${ch.isWritableWithResponse} notify=${ch.isNotifiable})`);
    }
  }

  onStatus?.('Pairing...');

  // Enable notifications on RX channel 0 (triggers OS BLE pairing)
  console.log('[BLE:Sync] Enabling RX0 notifications (triggers OS pairing)...');
  const rxSub = connected.monitorCharacteristicForService(
    OMRON_SERVICE_UUID,
    RX_CHAR_UUIDS[0],
    (error, char) => {
      if (error) console.log('[BLE:Sync] RX0 notify error:', error.message);
      if (char?.value) {
        const data = base64ToUint8Array(char.value);
        console.log(hexDump(data, 'RX0 pairing notify'));
      }
    }
  );

  // Enter key programming mode
  console.log('[BLE:Sync] Entering key programming mode (0x02 + 16 zeros)...');
  const programModeCmd = new Uint8Array(17);
  programModeCmd[0] = 0x02;

  let programModeSuccess = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    console.log(`[BLE:Sync] Programming mode attempt ${attempt + 1}/10`);
    const notifyPromise = waitForNotification(connected, UNLOCK_CHAR_UUID, 2000);
    await writeCharacteristic(connected, UNLOCK_CHAR_UUID, programModeCmd);
    try {
      const response = await notifyPromise;
      console.log(`[BLE:Sync] Unlock response: 0x${response[0].toString(16)}${response[1].toString(16)}`);
      if (response[0] === 0x82 && response[1] === 0x00) {
        programModeSuccess = true;
        console.log('[BLE:Sync] Programming mode entered successfully');
        break;
      }
    } catch (e: any) {
      console.log(`[BLE:Sync] Attempt ${attempt + 1} failed: ${e.message}`);
    }
  }

  rxSub.remove();

  if (!programModeSuccess) {
    console.log('[BLE:Sync] FAILED to enter programming mode after 10 attempts');
    await connected.cancelConnection();
    throw new Error('Failed to enter pairing mode. Make sure the monitor shows "-P-".');
  }

  // Write the pairing key
  console.log('[BLE:Sync] Writing pairing key...');
  const keyCmd = new Uint8Array(17);
  keyCmd[0] = 0x00;
  keyCmd.set(PAIRING_KEY, 1);

  const keyNotifyPromise = waitForNotification(connected, UNLOCK_CHAR_UUID);
  await writeCharacteristic(connected, UNLOCK_CHAR_UUID, keyCmd);
  const keyResponse = await keyNotifyPromise;

  console.log(`[BLE:Sync] Key response: 0x${keyResponse[0].toString(16)}${keyResponse[1].toString(16)}`);

  if (keyResponse[0] !== 0x80 || keyResponse[1] !== 0x00) {
    console.log('[BLE:Sync] FAILED to store pairing key');
    await connected.cancelConnection();
    throw new Error('Failed to store pairing key.');
  }

  console.log('[BLE:Sync] Pairing key stored. Running start/end cycle...');
  onStatus?.('Paired successfully!');

  // Run start/end cycle (required after first pair)
  const startResponse = await sendCommand(connected, buildStartCommand());
  const startType = parseResponseType(startResponse);
  if (startType !== 0x8000) {
    console.log(`[BLE:Sync] Unexpected start response: 0x${startType.toString(16)}`);
    await connected.cancelConnection();
    throw new Error('Start transmission failed after pairing.');
  }
  await sendCommand(connected, buildEndCommand());

  console.log('[BLE:Sync] Pairing complete, disconnecting');
  await connected.cancelConnection();
  return device;
}

async function unlockDevice(device: Device, onStatus?: StatusCallback): Promise<Device> {
  onStatus?.('Connecting...');
  console.log(`[BLE:Sync] Connecting to ${device.id} for unlock...`);
  const connected = await device.connect();
  await connected.discoverAllServicesAndCharacteristics();

  onStatus?.('Authenticating...');
  console.log('[BLE:Sync] Sending unlock command (0x01 + key)...');
  const unlockCmd = new Uint8Array(17);
  unlockCmd[0] = 0x01;
  unlockCmd.set(PAIRING_KEY, 1);

  const notifyPromise = waitForNotification(connected, UNLOCK_CHAR_UUID);
  await writeCharacteristic(connected, UNLOCK_CHAR_UUID, unlockCmd);
  const response = await notifyPromise;

  console.log(`[BLE:Sync] Unlock response: 0x${response[0].toString(16)}${response[1].toString(16)}`);

  if (response[0] !== 0x81 || response[1] !== 0x00) {
    console.log('[BLE:Sync] UNLOCK FAILED');
    await connected.cancelConnection();
    throw new Error('Authentication failed. Try re-pairing the monitor.');
  }

  console.log('[BLE:Sync] Unlock successful');
  return connected;
}

export async function syncReadings(
  device: Device,
  onStatus?: StatusCallback
): Promise<number> {
  const connected = await unlockDevice(device, onStatus);

  try {
    // Start transmission
    onStatus?.('Starting data transfer...');
    console.log('[BLE:Sync] Sending START command...');
    const startResponse = await sendCommand(connected, buildStartCommand());
    const startType = parseResponseType(startResponse);
    if (startType !== 0x8000) {
      console.log(`[BLE:Sync] START failed: type=0x${startType.toString(16)}`);
      throw new Error('Failed to start data transfer.');
    }
    console.log('[BLE:Sync] START acknowledged');

    // Read all record slots
    onStatus?.('Reading records...');
    const readings: OmronReading[] = [];
    let emptyCount = 0;
    let errorCount = 0;

    for (let i = 0; i < RECORDS_PER_USER; i++) {
      const address = RECORD_START_ADDRESS + i * RECORD_SIZE;
      console.log(`[BLE:Sync] Reading record ${i + 1}/${RECORDS_PER_USER} @0x${address.toString(16)}`);

      let response: Uint8Array;
      let retries = 0;
      while (true) {
        try {
          response = await sendCommand(connected, buildReadCommand(address, BLOCK_SIZE));
          break;
        } catch (e: any) {
          retries++;
          if (retries >= 5) {
            console.log(`[BLE:Sync] Record ${i} FAILED after 5 retries: ${e.message}`);
            errorCount++;
            break;
          }
          console.log(`[BLE:Sync] Record ${i} retry ${retries}: ${e.message}`);
        }
      }
      if (retries >= 5) continue;

      const responseType = parseResponseType(response!);
      if (responseType !== 0x8100) {
        console.log(`[BLE:Sync] Record ${i}: unexpected response type 0x${responseType.toString(16)}`);
        errorCount++;
        continue;
      }

      const recordData = extractResponseData(response!);
      if (recordData.length < RECORD_SIZE) {
        console.log(`[BLE:Sync] Record ${i}: short data (${recordData.length} bytes)`);
        errorCount++;
        continue;
      }

      dumpRecord(recordData, i);

      if (isEmptyRecord(recordData)) {
        emptyCount++;
        continue;
      }

      const parsed = parseRecord(recordData);
      if (parsed) readings.push(parsed);
    }

    console.log(
      `[BLE:Sync] Read complete: ${readings.length} valid, ${emptyCount} empty, ${errorCount} errors`
    );

    // End transmission
    onStatus?.('Finishing...');
    console.log('[BLE:Sync] Sending END command...');
    const endResponse = await sendCommand(connected, buildEndCommand());
    const endType = parseResponseType(endResponse);
    if (endType !== 0x8f00) {
      console.log(`[BLE:Sync] END unexpected: type=0x${endType.toString(16)}`);
    }

    // Import new readings (deduplicate by timestamp)
    let imported = 0;
    let duplicates = 0;
    for (const omronReading of readings) {
      const timestamp = omronReading.timestamp.toISOString();
      const exists = await readingExistsByTimestamp(timestamp);
      if (exists) {
        duplicates++;
        continue;
      }

      const reading: Reading = {
        id: uuidv4(),
        systolic: omronReading.systolic,
        diastolic: omronReading.diastolic,
        heartRate: omronReading.heartRate,
        timestamp,
        notes: omronReading.irregularHeartbeat ? 'Irregular heartbeat detected' : null,
        sourceImageUri: null,
      };
      await addReading(reading);
      imported++;
      console.log(`[BLE:Sync] Imported: ${reading.systolic}/${reading.diastolic} @ ${timestamp}`);
    }

    console.log(`[BLE:Sync] Import complete: ${imported} new, ${duplicates} duplicates`);
    onStatus?.(`Imported ${imported} new reading${imported !== 1 ? 's' : ''}.`);
    return imported;
  } finally {
    console.log('[BLE:Sync] Disconnecting...');
    await connected.cancelConnection();
  }
}
