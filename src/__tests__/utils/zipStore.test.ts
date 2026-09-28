import { buildZipBytes, crc32, utf8Encode } from '../../utils/zipStore';

function findAscii(bytes: Uint8Array, text: string): number {
  const needle = utf8Encode(text);
  for (let i = 0; i <= bytes.length - needle.length; i += 1) {
    let match = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

describe('zipStore', () => {
  it('builds a STORE zip that contains the file name and payload', () => {
    const bytes = buildZipBytes([{ name: 'folder/hello.csv', content: 'Metric,Value\r\nClasses,1\r\n' }]);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(findAscii(bytes, 'folder/hello.csv')).toBeGreaterThan(-1);
    expect(findAscii(bytes, 'Classes,1')).toBeGreaterThan(-1);
  });

  it('computes a known CRC-32', () => {
    expect(crc32(utf8Encode('123456789')).toString(16)).toBe('cbf43926');
  });
});
