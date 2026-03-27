/**
 * Real EEPROM hex dump captured from a BP7150 (HEM-7150T) on 2026-03-27.
 * 60 blocks × 16 bytes = 960 bytes, starting at address 0x0098.
 *
 * Cross-validated against Omron Connect app readings:
 *   - 117/70 HR=70  @ 2026-03-17 14:38
 *   - 117/70 HR=59  @ 2026-03-17 22:17
 *   - 118/68 HR=65  @ 2026-03-27 14:39
 */
export const EEPROM_HEX_BLOCKS: string[] = [
  '62 72 f5 62 02 c1 e1 32 22 12 d1 81 61 71 b1 f1', // 0x0098
  '91 a1 30 a2 82 00 10 20 92 f2 23 03 c2 d2 e2 13', // 0x00a8
  'f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5', // 0x00b8
  'f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5', // 0x00c8
  'f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5', // 0x00d8
  'f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5 f5', // 0x00e8
  'f5 f5 f5 f5 f5 f5 6f db 0a 05 44 06 00 00 00 00', // 0x00f8
  '08 73 91 10 fa 45 6f 64 f0 00 00 09 91 0b 00 00', // 0x0108
  '00 80 1c 80 10 80 2d 2d 66 99 2d 2d 1a 15 77 9b', // 0x0118
  '1a 2d 58 1e 0f 94 82 2d 00 00 00 2c 30 0a f0 40', // 0x0128
  '14 00 ef 73 d3 a7 0a 00 00 00 80 88 ec 60 f4 00', // 0x0138
  '00 00 00 00 00 00 00 1e 00 1e 00 00 19 1e 72 05', // 0x0148
  '3d 0f 00 00 00 00 00 00 00 06 22 00 28 50 95 16', // 0x0158
  '1f 26 2a 00 fa 10 01 01 a4 bd 10 18 85 33 b7 c4', // 0x0168
  'b2 00 00 00 00 00 3e e0 16 00 00 40 b6 0a 0e 20', // 0x0178
  '22 64 00 00 04 82 10 0a 18 33 02 00 02 33 62 24', // 0x0188
  '30 08 06 00 10 30 4c 08 82 50 00 00 00 00 bd 60', // 0x0198
  '00 12 00 00 00 00 d4 00 00 00 a2 30 55 01 10 00', // 0x01a8
  '40 00 02 55 64 04 00 00 00 00 00 00 00 00 00 00', // 0x01b8
  '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00', // 0x01c8
  '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00', // 0x01d8
  '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00', // 0x01e8
  '00 00 00 00 00 00 e0 75 11 13 ff ff 85 00 85 00', // 0x01f8
  '00 00 7f 00 03 80 00 80 00 80 00 80 00 80 00 80', // 0x0208
  'ff ff 55 84 00 00 0f e8 55 84 00 00 15 ee 55 84', // 0x0218
  '00 00 15 ee ff ff ff ff ff ff ff ff ff ff ff ff', // 0x0228
  'ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff', // 0x0238
  'ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff', // 0x0248
  'ff ff ff ff ff ff ff ff 0b c0 00 80 00 80 00 80', // 0x0258
  '7c 00 00 00 00 00 00 80 00 01 01 00 04 00 00 00', // 0x0268
  '00 00 00 00 06 f9 ff ff 00 00 00 00 00 00 00 00', // 0x0278
  '00 00 fe 01 c0 a0 00 00 00 00 00 00 1a 03 1b 11', // 0x0288
  '08 1b cc 33 ff ff ff ff ff ff ff ff 00 00 00 00', // 0x0298
  '00 00 00 00 7c 00 00 00 00 00 00 80 00 00 01 00', // 0x02a8
  '04 00 00 00 00 00 00 00 06 fa 00 00 ff ff ff ff', // 0x02b8
  'ff ff ff ff ff ff ff ff c0 a0 00 00 00 00 00 00', // 0x02c8
  '00 00 1b 0e 28 25 f3 0d ff ff ff ff ff ff ff ff', // 0x02d8
  '5e 57 55 15 20 04 3f 10 80 00 72 00 84 7b 62 58', // 0x02e8
  '3f 15 20 04 3f 10 80 00 73 00 74 8b 5e 4d 38 15', // 0x02f8
  '20 04 3f 10 80 10 74 00 6f 90 5e 4b 44 15 20 04', // 0x0308
  '3f 10 80 00 75 00 6a 95 5a 4e 4a 15 20 04 3f 10', // 0x0318
  '80 00 76 00 70 8f 54 50 43 15 20 44 3f 10 80 20', // 0x0328
  '77 00 c6 39 5f 45 3b 15 20 04 3f 20 80 00 78 00', // 0x0338
  '6f 90 57 41 36 15 20 04 3f 10 80 00 79 00 4f b0', // 0x0348
  '5c 46 46 1a 2e 0e 95 19 80 01 7a 00 e7 18 5c 46', // 0x0358
  '3b 1a 36 0e 47 14 80 00 7b 00 91 6e 5d 44 41 1a', // 0x0368
  '6e 0f ef 19 80 00 7c 00 7d 82 64 53 45 15 20 04', // 0x0378
  '3f 10 80 00 6f 00 73 8c 5b 52 43 15 20 04 3f 10', // 0x0388
  '80 00 70 00 68 97 67 57 54 15 20 04 3f 10 80 00', // 0x0398
  '71 00 8b 74 ff ff ff ff ff ff ff ff ff ff ff ff', // 0x03a8
  'ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff', // 0x03b8
  'ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff', // 0x03c8
  'ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff', // 0x03d8
  'ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff', // 0x03e8
  'ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff', // 0x03f8
  'ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff', // 0x0408
  'ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff', // 0x0418
  'ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff', // 0x0428
  'ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff', // 0x0438
  'ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff', // 0x0448
];

/** Parse hex dump strings into Uint8Array blocks */
export function hexToBlocks(hexLines: string[]): Uint8Array[] {
  return hexLines.map(line => {
    const bytes = line.trim().split(/\s+/).map(h => parseInt(h, 16));
    return new Uint8Array(bytes);
  });
}
