import { BleManager, Device } from 'react-native-ble-plx';
import {
  OMRON_COMM_SERVICE_UUID,
  OMRON_SCAN_UUIDS,
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
  bytesToHex,
} from './omronProtocol';
import { parseAllRecords, isEmptyRecord } from './omronParser';
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

async function writeCharacteristic(
  device: Device,
  charUuid: string,
  data: Uint8Array,
  withResponse: boolean = true
): Promise<void> {
  if (withResponse) {
    await device.writeCharacteristicWithResponseForService(
      OMRON_COMM_SERVICE_UUID,
      charUuid,
      uint8ArrayToBase64(data)
    );
  } else {
    await device.writeCharacteristicWithoutResponseForService(
      OMRON_COMM_SERVICE_UUID,
      charUuid,
      uint8ArrayToBase64(data)
    );
  }
}

/**
 * Diagnostic: scan for ALL BLE devices and log them.
 * Helps identify the correct service UUID if filtered scan fails.
 */
export async function diagnosticScan(durationMs: number = 10000): Promise<void> {
  console.log('[BLE:Scan] === DIAGNOSTIC SCAN (unfiltered) ===');
  const seen = new Set<string>();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      manager.stopDeviceScan();
      console.log(`[BLE:Scan] === DIAGNOSTIC SCAN COMPLETE: ${seen.size} devices found ===`);
      resolve();
    }, durationMs);

    manager.startDeviceScan(
      null, // no service filter
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          console.log('[BLE:Scan] Scan error:', error.message);
          return;
        }
        if (device && !seen.has(device.id)) {
          seen.add(device.id);
          const serviceUUIDs = device.serviceUUIDs?.join(', ') || 'none';
          console.log(
            `[BLE:Scan] Device: name="${device.name || '(null)'}" ` +
            `id=${device.id} rssi=${device.rssi} ` +
            `services=[${serviceUUIDs}]`
          );
        }
      }
    );
  });
}

export async function scanForOmron(onStatus?: StatusCallback): Promise<Device> {
  onStatus?.('Scanning for Omron monitor...');
  console.log('[BLE:Sync] Scanning with Omron UUIDs:', OMRON_SCAN_UUIDS.join(', '));

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      manager.stopDeviceScan();
      console.log('[BLE:Sync] Scan timeout — no Omron device found');
      reject(new Error('Could not find Omron monitor. Make sure it is nearby and turned on.'));
    }, 15000);

    manager.startDeviceScan(
      [...OMRON_SCAN_UUIDS],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          clearTimeout(timer);
          manager.stopDeviceScan();
          console.log('[BLE:Sync] Scan error:', error.message);
          reject(error);
          return;
        }
        if (device) {
          const name = device.name || device.localName || '';
          console.log(
            `[BLE:Sync] Scan hit: name="${name}" id=${device.id} rssi=${device.rssi} ` +
            `services=[${device.serviceUUIDs?.join(', ') || 'none'}]`
          );

          // Prefer device named BP7150, or accept any match
          clearTimeout(timer);
          manager.stopDeviceScan();
          console.log(`[BLE:Sync] Selected device: name="${name}" id=${device.id}`);
          onStatus?.(`Found: ${name || device.id}`);
          resolve(device);
        }
      }
    );
  });
}

/**
 * Wait for a notification using a persistent subscription.
 * The subscription must be set up BEFORE writing to the characteristic.
 */
function createNotificationQueue(device: Device, serviceUuid: string, charUuid: string) {
  const pending: Array<{
    resolve: (data: Uint8Array) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  console.log(`[BLE:Sync] Setting up persistent notification listener on ${charUuid.substring(0, 8)}`);

  const subscription = device.monitorCharacteristicForService(
    serviceUuid,
    charUuid,
    (error, char) => {
      if (error) {
        console.log(`[BLE:Sync] Notification error on ${charUuid.substring(0, 8)}: ${error.message}`);
        if (pending.length > 0) {
          const p = pending.shift()!;
          clearTimeout(p.timer);
          p.reject(error);
        }
        return;
      }
      if (char?.value) {
        const data = base64ToUint8Array(char.value);
        if (pending.length > 0) {
          const p = pending.shift()!;
          clearTimeout(p.timer);
          p.resolve(data);
        } else {
          console.log(`[BLE:Sync] UNEXPECTED notification (no pending wait) on ${charUuid.substring(0, 8)}`);
        }
      }
    }
  );

  return {
    waitNext(timeoutMs: number = 5000): Promise<Uint8Array> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const idx = pending.findIndex(p => p.timer === timer);
          if (idx >= 0) pending.splice(idx, 1);
          console.log(`[BLE:Sync] TIMEOUT waiting for notification on ${charUuid.substring(0, 8)} (${timeoutMs}ms)`);
          reject(new Error('BLE notification timeout'));
        }, timeoutMs);
        pending.push({ resolve, reject, timer });
      });
    },
    remove() {
      subscription.remove();
      // Reject any pending waits
      for (const p of pending) {
        clearTimeout(p.timer);
        p.reject(new Error('Subscription removed'));
      }
      pending.length = 0;
    },
  };
}

export async function pairDevice(device: Device, onStatus?: StatusCallback): Promise<Device> {
  onStatus?.('Connecting...');
  console.log(`[BLE:Sync] Connecting to ${device.id}...`);
  const connected = await device.connect();
  console.log('[BLE:Sync] Connected, discovering services...');
  await connected.discoverAllServicesAndCharacteristics();

  onStatus?.('Pairing...');

  // === STRATEGY A: Try no-pairing flow (newer HW revisions) ===
  // Some BP7150 revisions use 0000fe4a with pairing=false
  // In this case, skip unlock and go straight to data transfer
  console.log('[BLE:Sync] === Strategy A: No-pairing flow (direct data transfer) ===');
  onStatus?.('Trying direct connection...');

  const rxQueue = createNotificationQueue(connected, OMRON_COMM_SERVICE_UUID, RX_CHAR_UUIDS[0]);

  try {
    console.log('[BLE:Sync] Sending START command without unlock...');
    await writeCharacteristic(connected, TX_CHAR_UUIDS[0], buildStartCommand());
    const startResponse = await rxQueue.waitNext(5000);
    const startType = parseResponseType(startResponse);

    if (startType === 0x8000) {
      console.log('[BLE:Sync] START succeeded WITHOUT unlock! This is a no-pairing device.');
      onStatus?.('Connected! (no pairing needed)');
      // End the test transmission
      await writeCharacteristic(connected, TX_CHAR_UUIDS[0], buildEndCommand());
      await rxQueue.waitNext(3000).catch(() => {});
      rxQueue.remove();
      console.log('[BLE:Sync] Pairing complete (no-pairing variant), disconnecting');
      await connected.cancelConnection();
      return device;
    } else {
      console.log(`[BLE:Sync] START returned 0x${startType.toString(16)} — device needs pairing`);
    }
  } catch (e: any) {
    console.log(`[BLE:Sync] Strategy A failed: ${e.message} — device likely needs pairing`);
  }

  // === STRATEGY B: Full pairing flow ===
  console.log('[BLE:Sync] === Strategy B: Full pairing flow ===');
  onStatus?.('Pairing...');

  const unlockQueue = createNotificationQueue(connected, OMRON_COMM_SERVICE_UUID, UNLOCK_CHAR_UUID);

  // Step 1: Try to read the unlock characteristic to trigger iOS BLE bonding
  console.log('[BLE:Sync] Reading unlock char to trigger iOS bonding...');
  try {
    const readResult = await connected.readCharacteristicForService(
      OMRON_COMM_SERVICE_UUID,
      UNLOCK_CHAR_UUID
    );
    if (readResult.value) {
      const data = base64ToUint8Array(readResult.value);
      console.log(hexDump(data, 'READ unlock'));
    }
  } catch (e: any) {
    console.log(`[BLE:Sync] Read unlock error: ${e.message}`);
  }

  // Step 2: Try program mode (0x02 + zeros)
  console.log('[BLE:Sync] Trying program mode (0x02 + zeros)...');
  const programModeCmd = new Uint8Array(17);
  programModeCmd[0] = 0x02;

  let programSuccess = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    console.log(`[BLE:Sync] Program mode attempt ${attempt + 1}/5`);
    try {
      await writeCharacteristic(connected, UNLOCK_CHAR_UUID, programModeCmd);
      const resp = await unlockQueue.waitNext(4000);
      console.log(`[BLE:Sync] Program mode response: ${bytesToHex(resp)}`);
      if (resp[0] === 0x82) {
        programSuccess = true;
        break;
      }
    } catch (e: any) {
      console.log(`[BLE:Sync] Attempt ${attempt + 1} failed: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  if (programSuccess) {
    // Write the pairing key
    console.log('[BLE:Sync] Writing pairing key...');
    const keyCmd = new Uint8Array(17);
    keyCmd[0] = 0x00;
    keyCmd.set(PAIRING_KEY, 1);
    await writeCharacteristic(connected, UNLOCK_CHAR_UUID, keyCmd);
    try {
      const keyResp = await unlockQueue.waitNext(5000);
      console.log(`[BLE:Sync] Key store response: ${bytesToHex(keyResp)}`);
    } catch (e: any) {
      console.log(`[BLE:Sync] Key store timeout: ${e.message}`);
    }
  } else {
    // Step 3: Try direct unlock (0x01 + key) — maybe key was already programmed
    console.log('[BLE:Sync] Program mode failed. Trying direct unlock (0x01 + key)...');
    const unlockCmd = new Uint8Array(17);
    unlockCmd[0] = 0x01;
    unlockCmd.set(PAIRING_KEY, 1);

    let unlockSuccess = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await writeCharacteristic(connected, UNLOCK_CHAR_UUID, unlockCmd);
        const resp = await unlockQueue.waitNext(4000);
        console.log(`[BLE:Sync] Unlock response: ${bytesToHex(resp)}`);
        if (resp[0] === 0x81) {
          unlockSuccess = true;
          break;
        }
      } catch (e: any) {
        console.log(`[BLE:Sync] Unlock attempt ${attempt + 1} failed: ${e.message}`);
      }
    }

    if (!unlockSuccess) {
      unlockQueue.remove();
      rxQueue.remove();
      console.log('[BLE:Sync] ALL PAIRING STRATEGIES FAILED');
      console.log('[BLE:Sync] NOTE: The device may require iOS-level BLE bonding first.');
      console.log('[BLE:Sync] Try going to iOS Settings > Bluetooth and pairing the BP7150 there.');
      await connected.cancelConnection();
      throw new Error(
        'Could not pair with monitor. Try:\n' +
        '1. Go to iOS Settings > Bluetooth\n' +
        '2. Put monitor in pairing mode (-P-)\n' +
        '3. Pair it from iOS Settings\n' +
        '4. Then try Sync from the app'
      );
    }
  }

  unlockQueue.remove();
  rxQueue.remove();
  console.log('[BLE:Sync] Pairing complete, disconnecting');
  await connected.cancelConnection();
  return device;
}

async function connectDevice(device: Device, onStatus?: StatusCallback): Promise<Device> {
  onStatus?.('Connecting...');
  console.log(`[BLE:Sync] Connecting to ${device.id}...`);
  const connected = await device.connect();
  await connected.discoverAllServicesAndCharacteristics();
  console.log('[BLE:Sync] Connected and services discovered');
  return connected;
}

export async function syncReadings(
  device: Device,
  onStatus?: StatusCallback
): Promise<number> {
  const connected = await connectDevice(device, onStatus);
  const rxQueue = createNotificationQueue(connected, OMRON_COMM_SERVICE_UUID, RX_CHAR_UUIDS[0]);
  const unlockQueue = createNotificationQueue(connected, OMRON_COMM_SERVICE_UUID, UNLOCK_CHAR_UUID);

  async function sendCmd(command: Uint8Array): Promise<Uint8Array> {
    await writeCharacteristic(connected, TX_CHAR_UUIDS[0], command);
    return rxQueue.waitNext(5000);
  }

  try {
    // Try unlock first (key may already be stored from previous pairing)
    console.log('[BLE:Sync] Trying unlock (0x01 + key)...');
    onStatus?.('Authenticating...');
    const unlockCmd = new Uint8Array(17);
    unlockCmd[0] = 0x01;
    unlockCmd.set(PAIRING_KEY, 1);
    try {
      await writeCharacteristic(connected, UNLOCK_CHAR_UUID, unlockCmd);
      const unlockResp = await unlockQueue.waitNext(3000);
      console.log(`[BLE:Sync] Unlock response: ${bytesToHex(unlockResp)}`);
    } catch (e: any) {
      console.log(`[BLE:Sync] Unlock timeout (may not be needed): ${e.message}`);
    }
    unlockQueue.remove();

    // Start transmission
    onStatus?.('Starting data transfer...');
    console.log('[BLE:Sync] Sending START command...');
    const startResponse = await sendCmd(buildStartCommand());
    const startType = parseResponseType(startResponse);
    if (startType !== 0x8000) {
      console.log(`[BLE:Sync] START failed: type=0x${startType.toString(16)}`);
      throw new Error('Failed to start data transfer.');
    }
    console.log('[BLE:Sync] START acknowledged');

    // Read all record blocks from EEPROM
    onStatus?.('Reading records...');
    const allBlocks: Uint8Array[] = [];
    let emptyCount = 0;
    let errorCount = 0;

    for (let i = 0; i < RECORDS_PER_USER; i++) {
      const address = RECORD_START_ADDRESS + i * RECORD_SIZE;
      if (i % 10 === 0) {
        onStatus?.(`Reading blocks ${i + 1}/${RECORDS_PER_USER}...`);
      }

      let response: Uint8Array;
      let retries = 0;
      while (true) {
        try {
          response = await sendCmd(buildReadCommand(address, BLOCK_SIZE));
          break;
        } catch (e: any) {
          retries++;
          if (retries >= 5) {
            console.log(`[BLE:Sync] Block ${i} FAILED after 5 retries: ${e.message}`);
            errorCount++;
            break;
          }
          console.log(`[BLE:Sync] Block ${i} retry ${retries}: ${e.message}`);
        }
      }
      if (retries >= 5) continue;

      const responseType = parseResponseType(response!);
      if (responseType !== 0x8100) {
        console.log(`[BLE:Sync] Block ${i}: unexpected response type 0x${responseType.toString(16)}`);
        errorCount++;
        continue;
      }

      const blockData = extractResponseData(response!);
      if (blockData.length < RECORD_SIZE) {
        console.log(`[BLE:Sync] Block ${i}: short data (${blockData.length} bytes)`);
        errorCount++;
        continue;
      }

      if (isEmptyRecord(blockData)) {
        emptyCount++;
      }

      allBlocks.push(blockData);
    }

    // Parse all blocks as a continuous byte stream
    console.log(`[BLE:Sync] Read ${allBlocks.length} blocks (${emptyCount} empty, ${errorCount} errors)`);
    onStatus?.('Parsing readings...');
    const readings = parseAllRecords(allBlocks);

    // End transmission
    onStatus?.('Finishing...');
    console.log('[BLE:Sync] Sending END command...');
    const endResponse = await sendCmd(buildEndCommand());
    const endType = parseResponseType(endResponse);
    if (endType !== 0x8f00) {
      console.log(`[BLE:Sync] END unexpected: type=0x${endType.toString(16)}`);
    }

    // Import readings
    let imported = 0;
    for (const omronReading of readings) {
      const timestamp = omronReading.timestamp.toISOString();

      if (await readingExistsByTimestamp(timestamp)) {
        continue;
      }

      const reading: Reading = {
        id: uuidv4(),
        systolic: omronReading.systolic,
        diastolic: omronReading.diastolic,
        heartRate: omronReading.heartRate,
        timestamp,
        notes: null,
        source: 'ble',
      };
      await addReading(reading);
      imported++;
      console.log(`[BLE:Sync] Imported: ${reading.systolic}/${reading.diastolic} HR=${reading.heartRate} @ ${timestamp}`);
    }

    console.log(`[BLE:Sync] Import complete: ${imported} new readings`);
    onStatus?.(`Imported ${imported} reading${imported !== 1 ? 's' : ''}.`);
    return imported;
  } finally {
    rxQueue.remove();
    console.log('[BLE:Sync] Disconnecting...');
    await connected.cancelConnection();
  }
}
