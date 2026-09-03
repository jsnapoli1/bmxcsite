import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { storeUpload, isVideo, MAX_UPLOAD_BYTES_VIDEO } from '../../worker/media/repository.js';

/**
 * A minimal but genuine MP4 header: a 'ftyp' box with the 'isom' brand at
 * offset 4, which is what the sniffer keys on.
 */
function mp4Bytes(extra = 0) {
  const head = [
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x69, 0x73, 0x6f, 0x6d, // 'isom'
    0x00, 0x00, 0x02, 0x00,
  ];
  // Allocated and filled rather than spread: spreading a 200MB array into
  // an array literal blows the argument limit before the test can run.
  const bytes = new Uint8Array(head.length + extra);
  bytes.set(head);
  return bytes;
}

const upload = (bytes, contentType, filename = 'clip.mp4') => storeUpload(env, {
  bytes, filename, contentType, uploaderEmail: 'a@b.c',
});

describe('video uploads', () => {
  it('accepts a genuine mp4', async () => {
    const row = await upload(mp4Bytes(), 'video/mp4');
    expect(row.content_type).toBe('video/mp4');
    expect(row.key.endsWith('.mp4')).toBe(true);
  });

  it('stores a video private, exactly like a photo', async () => {
    const row = await upload(mp4Bytes(), 'video/mp4');
    expect(row.status).toBe('private');
  });

  it('refuses a file that claims to be mp4 but is not', async () => {
    const notVideo = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00]);
    await expect(upload(notVideo, 'video/mp4')).rejects.toThrow(/does not match/);
  });

  it('refuses an mp4 declared as an image', async () => {
    await expect(upload(mp4Bytes(), 'image/jpeg')).rejects.toThrow(/does not match/);
  });

  it('refuses a video over the video limit', async () => {
    // Constructed just past the ceiling. Uses the video limit, not the
    // image one — a 10MB cap would make video unusable.
    const tooBig = mp4Bytes(MAX_UPLOAD_BYTES_VIDEO);
    await expect(upload(tooBig, 'video/mp4')).rejects.toThrow(/over the/);
  });

  it('still holds images to the smaller image limit', async () => {
    // The larger video ceiling must not become the ceiling for everything.
    const jpeg = new Uint8Array(11 * 1024 * 1024);
    jpeg.set([0xff, 0xd8, 0xff]);
    await expect(upload(jpeg, 'image/jpeg', 'big.jpg')).rejects.toThrow(/over the/);
  });
});

describe('isVideo', () => {
  it('recognises mp4', () => expect(isVideo('video/mp4')).toBe(true));
  it('does not claim an image is video', () => expect(isVideo('image/jpeg')).toBe(false));
});

describe('the mp4 sniffer cannot be tricked', () => {
  it('a jpeg whose bytes 4-8 happen to read ftyp is still a jpeg', async () => {
    // 'ftyp' is matched at offset 4, which is inside a JPEG's payload. The
    // JPEG signature is checked at offset 0 first, so magic that appears
    // later cannot reclassify the file.
    const bytes = new Uint8Array(64);
    bytes.set([0xff, 0xd8, 0xff]);
    bytes.set([0x66, 0x74, 0x79, 0x70], 4);
    const row = await upload(bytes, 'image/jpeg', 'trick.jpg');
    expect(row.content_type).toBe('image/jpeg');
  });

  it('an mp4 declared as webp is refused', async () => {
    const bytes = new Uint8Array(32);
    bytes.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    await expect(upload(bytes, 'image/webp', 't.webp')).rejects.toThrow(/does not match/);
  });

  it('a 6-byte file claiming mp4 rejects rather than crashing', async () => {
    // Shorter than the offset the sniffer reads at — startsWith must
    // bounds-check rather than read past the end.
    await expect(upload(new Uint8Array([1, 2, 3, 4, 5, 6]), 'video/mp4')).rejects.toThrow();
  });
});
