import { deflateSync } from 'node:zlib';

// A real, decodable PNG with three colored panels for browser/Static Assets checks.
// Generated test data; no external image or license dependency.
function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  body.copy(result, 4);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}
const width = 640, height = 240;
const pixels = Buffer.alloc((width * 3 + 1) * height);
const colors = [[59, 130, 246], [16, 185, 129], [249, 115, 22]] as const;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const panel = Math.floor(x / 216);
    const color = y < 12 ? [15, 23, 42] : y >= 32 && y < 208 && x % 216 >= 16 && x % 216 < 200
      ? colors[panel]! : [241, 245, 249];
    const offset = y * (width * 3 + 1) + 1 + x * 3;
    pixels[offset] = color[0]!; pixels[offset + 1] = color[1]!; pixels[offset + 2] = color[2]!;
  }
}
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
header[8] = 8; header[9] = 2; // 8-bit RGB, no interlacing.
export const reviewImagePng = new Uint8Array(Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
  chunk('IDAT', deflateSync(pixels)), chunk('IEND', new Uint8Array()),
]));
