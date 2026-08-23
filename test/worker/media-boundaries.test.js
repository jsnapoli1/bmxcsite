import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { storeUpload } from '../../worker/media/repository.js';

const up = (bytes, contentType='image/webp') => storeUpload(env, {
  bytes, filename: 'x.webp', contentType, uploaderEmail: 'k@x.com' });

describe('RIFF container discrimination', () => {
  it('a WAV (RIFF but not WEBP) is refused as webp', async () => {
    // "RIFF....WAVE" — a real wav header
    const wav = new Uint8Array([0x52,0x49,0x46,0x46, 0,0,0,0, 0x57,0x41,0x56,0x45, ...new Array(32).fill(0)]);
    await expect(up(wav)).rejects.toMatchObject({ status: 400 });
  });
  it('an AVI (RIFF but not WEBP) is refused as webp', async () => {
    const avi = new Uint8Array([0x52,0x49,0x46,0x46, 0,0,0,0, 0x41,0x56,0x49,0x20, ...new Array(32).fill(0)]);
    await expect(up(avi)).rejects.toMatchObject({ status: 400 });
  });
  it('a genuine WEBP is accepted', async () => {
    const webp = new Uint8Array([0x52,0x49,0x46,0x46, 0,0,0,0, 0x57,0x45,0x42,0x50, ...new Array(32).fill(0)]);
    const row = await up(webp);
    expect(row.content_type).toBe('image/webp');
  });
  it('a 2-byte file rejects rather than crashing', async () => {
    await expect(up(new Uint8Array([0x52,0x49]))).rejects.toMatchObject({ status: 400 });
  });
  it('an empty file rejects rather than crashing', async () => {
    await expect(up(new Uint8Array([]))).rejects.toMatchObject({ status: 400 });
  });
  it('a file at exactly the size limit is accepted', async () => {
    const big = new Uint8Array(10 * 1024 * 1024);
    big.set([0xFF,0xD8,0xFF]);
    const row = await storeUpload(env, { bytes: big, filename:'b.jpg', contentType:'image/jpeg', uploaderEmail:'k@x.com' });
    expect(row.size_bytes).toBe(10 * 1024 * 1024);
  });
  it('one byte over the limit is refused with 413', async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set([0xFF,0xD8,0xFF]);
    await expect(storeUpload(env, { bytes: big, filename:'b.jpg', contentType:'image/jpeg', uploaderEmail:'k@x.com' }))
      .rejects.toMatchObject({ status: 413 });
  });
});
