/**
 * Debug utilities for re-parsing raw EEPROM data stored in the database.
 *
 * When a BLE sync captures readings, the raw EEPROM blocks are base64-encoded
 * and stored in the `rawData` column. This module lets you decode and re-parse
 * that data without reconnecting to the device — useful for debugging timestamp
 * decoding, missed readings, or parser changes.
 */

import { parseAllRecords } from './omronParser';
import { OmronReading, BLOCK_SIZE } from './types';
import { bytesToHex } from './omronProtocol';

/**
 * Encode an array of EEPROM blocks into a single base64 string for storage.
 */
export function encodeRawBlocks(blocks: Uint8Array[]): string {
  const totalLen = blocks.reduce((sum, b) => sum + b.length, 0);
  const buffer = new Uint8Array(totalLen);
  let offset = 0;
  for (const block of blocks) {
    buffer.set(block, offset);
    offset += block.length;
  }
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

/**
 * Decode a base64 raw data string back into EEPROM blocks.
 */
export function decodeRawBlocks(base64: string): Uint8Array[] {
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }

  const blocks: Uint8Array[] = [];
  for (let i = 0; i < buffer.length; i += BLOCK_SIZE) {
    blocks.push(buffer.slice(i, i + BLOCK_SIZE));
  }
  return blocks;
}

/**
 * Re-parse readings from a base64 raw data string.
 * Returns the same OmronReading[] that the original sync would have produced.
 */
export function reparseFromRawData(base64: string): OmronReading[] {
  const blocks = decodeRawBlocks(base64);
  return parseAllRecords(blocks);
}

/**
 * Dump raw EEPROM data as hex for visual inspection.
 * Returns an array of lines like "0x0000: 79 00 4f b0 5c 46 46 1a 2e 0e 95 19 80 01 00 00"
 */
export function hexDumpRawData(base64: string): string[] {
  const blocks = decodeRawBlocks(base64);
  const lines: string[] = [];
  let offset = 0;
  for (const block of blocks) {
    const addr = `0x${offset.toString(16).padStart(4, '0')}`;
    lines.push(`${addr}: ${bytesToHex(block)}`);
    offset += block.length;
  }
  return lines;
}

/**
 * Detailed debug output: re-parses raw data and returns a structured report.
 * Useful for logging or displaying in a debug UI.
 */
export function debugParseReport(base64: string): {
  totalBlocks: number;
  totalBytes: number;
  readings: Array<{
    counter: number;
    systolic: number;
    diastolic: number;
    heartRate: number;
    timestamp: string;
  }>;
  hexDump: string[];
} {
  const blocks = decodeRawBlocks(base64);
  const readings = parseAllRecords(blocks);
  const hexLines = hexDumpRawData(base64);

  return {
    totalBlocks: blocks.length,
    totalBytes: blocks.reduce((sum, b) => sum + b.length, 0),
    readings: readings.map((r) => ({
      counter: r.counter,
      systolic: r.systolic,
      diastolic: r.diastolic,
      heartRate: r.heartRate,
      timestamp: r.timestamp.toISOString(),
    })),
    hexDump: hexLines,
  };
}
