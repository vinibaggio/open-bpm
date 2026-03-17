/**
 * Omron BLE packet framing and command construction.
 *
 * Packet format:
 *   [total_len] [cmd_hi] [cmd_lo] [addr_hi] [addr_lo] [data_len] [data...] [0x00 pad] [xor_crc]
 *
 * XOR checksum: all bytes XORed together must equal 0.
 */

export function hexDump(data: Uint8Array, label?: string): string {
  const hex = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');
  const prefix = label ? `[BLE:Protocol] ${label}: ` : '[BLE:Protocol] ';
  return `${prefix}${hex} (${data.length} bytes)`;
}

export function computeXorChecksum(data: Uint8Array): number {
  let xor = 0;
  for (const byte of data) {
    xor ^= byte;
  }
  return xor;
}

export function verifyChecksum(data: Uint8Array): boolean {
  let xor = 0;
  for (const byte of data) {
    xor ^= byte;
  }
  const valid = xor === 0;
  if (!valid) {
    console.log(`[BLE:Protocol] CHECKSUM FAIL: XOR=${xor.toString(16)}, ${hexDump(data)}`);
  }
  return valid;
}

export function buildStartCommand(): Uint8Array {
  const cmd = new Uint8Array([0x08, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00]);
  cmd[7] = computeXorChecksum(cmd.subarray(0, 7));
  return cmd;
}

export function buildEndCommand(): Uint8Array {
  const cmd = new Uint8Array([0x08, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  cmd[7] = computeXorChecksum(cmd.subarray(0, 7));
  return cmd;
}

export function buildReadCommand(address: number, size: number): Uint8Array {
  const addrHi = (address >> 8) & 0xff;
  const addrLo = address & 0xff;
  const cmd = new Uint8Array([0x08, 0x01, 0x00, addrHi, addrLo, size, 0x00, 0x00]);
  cmd[7] = computeXorChecksum(cmd.subarray(0, 7));
  return cmd;
}

export function parseResponseType(data: Uint8Array): number {
  if (data.length < 3) {
    console.log(`[BLE:Protocol] Response too short: ${data.length} bytes`);
    return -1;
  }
  const type = (data[1] << 8) | data[2];
  return type;
}

export function extractResponseData(data: Uint8Array): Uint8Array {
  // Response format: [len] [type_hi] [type_lo] [addr_hi] [addr_lo] [data_len] [data...] [pad] [crc]
  if (data.length < 7) {
    console.log(`[BLE:Protocol] Response too short for data extraction: ${data.length} bytes`);
    return new Uint8Array(0);
  }
  const declaredLen = data[0];
  const dataLen = data[5];
  const extracted = data.slice(6, 6 + dataLen);

  if (declaredLen !== data.length) {
    console.log(
      `[BLE:Protocol] LENGTH MISMATCH: declared=${declaredLen} actual=${data.length}`
    );
  }

  verifyChecksum(data);

  return extracted;
}
