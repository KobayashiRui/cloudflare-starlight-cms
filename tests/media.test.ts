import { describe, expect, it } from 'vitest';
import { signatureMatches } from '../src/media/service.ts';

describe('media signatures', () => {
  it.each([
    ['image/png', [0x89, 0x50, 0x4e, 0x47]],
    ['image/jpeg', [0xff, 0xd8, 0xff]],
    ['image/webp', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
    ['image/avif', [0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]],
    ['video/mp4', [0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]],
    ['video/webm', [0x1a, 0x45, 0xdf, 0xa3]],
  ])('accepts a valid %s header', (type, bytes) => {
    expect(signatureMatches(type, new Uint8Array(bytes))).toBe(true);
  });
  it('rejects mismatched bytes', () => {
    expect(signatureMatches('video/mp4', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });
});
