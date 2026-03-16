import {
  buildReadCommand,
  buildStartCommand,
  buildEndCommand,
  computeXorChecksum,
  parseResponseType,
  extractResponseData,
  verifyChecksum,
} from '../omronProtocol';

describe('computeXorChecksum', () => {
  it('produces a byte that makes XOR of all bytes equal 0', () => {
    const data = new Uint8Array([0x08, 0x01, 0x00, 0x00, 0x98, 0x10, 0x00]);
    const crc = computeXorChecksum(data);
    let xor = 0;
    for (const b of data) xor ^= b;
    xor ^= crc;
    expect(xor).toBe(0);
  });
});

describe('verifyChecksum', () => {
  it('returns true for valid packet', () => {
    const cmd = buildStartCommand();
    expect(verifyChecksum(cmd)).toBe(true);
  });

  it('returns false for corrupted packet', () => {
    const cmd = buildStartCommand();
    cmd[3] = 0xff; // corrupt a byte
    expect(verifyChecksum(cmd)).toBe(false);
  });
});

describe('buildStartCommand', () => {
  it('produces the correct start transmission packet', () => {
    const cmd = buildStartCommand();
    expect(cmd).toEqual(new Uint8Array([0x08, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x18]));
  });
});

describe('buildEndCommand', () => {
  it('produces the correct end transmission packet', () => {
    const cmd = buildEndCommand();
    expect(cmd).toEqual(new Uint8Array([0x08, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x07]));
  });
});

describe('buildReadCommand', () => {
  it('builds a read command for address 0x0098 size 0x10', () => {
    const cmd = buildReadCommand(0x0098, 0x10);
    expect(cmd.length).toBe(8);
    expect(cmd[1]).toBe(0x01);
    expect(cmd[2]).toBe(0x00);
    expect(cmd[3]).toBe(0x00);
    expect(cmd[4]).toBe(0x98);
    expect(cmd[5]).toBe(0x10);
    expect(verifyChecksum(cmd)).toBe(true);
  });

  it('handles high address bytes', () => {
    const cmd = buildReadCommand(0x0198, 0x10);
    expect(cmd[3]).toBe(0x01);
    expect(cmd[4]).toBe(0x98);
    expect(verifyChecksum(cmd)).toBe(true);
  });
});

describe('parseResponseType', () => {
  it('parses start ACK', () => {
    const data = new Uint8Array([0x08, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(parseResponseType(data)).toBe(0x8000);
  });

  it('parses read data response', () => {
    const data = new Uint8Array([0x18, 0x81, 0x00, 0x00, 0x98, 0x10, ...new Array(18).fill(0)]);
    expect(parseResponseType(data)).toBe(0x8100);
  });

  it('parses end ACK', () => {
    const data = new Uint8Array([0x08, 0x8f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(parseResponseType(data)).toBe(0x8f00);
  });

  it('returns -1 for too-short data', () => {
    expect(parseResponseType(new Uint8Array([0x01]))).toBe(-1);
  });
});

describe('extractResponseData', () => {
  it('extracts data payload from response', () => {
    // Simulate a read response with 16 bytes of data
    const payload = new Uint8Array(16).fill(0xab);
    const response = new Uint8Array(24); // len + header(5) + data(16) + pad + crc
    response[0] = 24; // total length
    response[1] = 0x81; response[2] = 0x00; // type
    response[3] = 0x00; response[4] = 0x98; // address
    response[5] = 16; // data length
    response.set(payload, 6);
    // pad + crc at end (not critical for extraction test)

    const extracted = extractResponseData(response);
    expect(extracted.length).toBe(16);
    expect(extracted.every(b => b === 0xab)).toBe(true);
  });

  it('returns empty for too-short response', () => {
    expect(extractResponseData(new Uint8Array([0x01, 0x02]))).toEqual(new Uint8Array(0));
  });
});
