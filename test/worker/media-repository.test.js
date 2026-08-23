import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import {
  MAX_UPLOAD_BYTES,
  ALLOWED_TYPES,
  UploadError,
  storeUpload,
  listMedia,
  publishMedia,
  unpublishMedia,
  getPublicObject,
} from '../../worker/media/repository.js';

// Minimal-but-valid magic-byte prefixes for each allowed type, padded with
// filler bytes so size-limit tests can control the total length precisely.
function jpegBytes(length = 32) {
  const bytes = new Uint8Array(length);
  bytes.set([0xff, 0xd8, 0xff, 0xe0], 0);
  return bytes;
}

function pngBytes(length = 32) {
  const bytes = new Uint8Array(length);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return bytes;
}

function webpBytes(length = 32) {
  const bytes = new Uint8Array(length);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  // bytes 4-7 are the RIFF chunk size (arbitrary for this test)
  bytes.set([0x00, 0x00, 0x00, 0x00], 4);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  return bytes;
}

// Text content, not an image — the "renamed script" attack.
function scriptBytes() {
  return new TextEncoder().encode('#!/bin/sh\necho pwned\n');
}

const UPLOADER = 'ken@example.com';
const EDITOR = 'sarah@example.com';

describe('media repository', () => {
  it('rejects a file over the size limit with 413', async () => {
    const bytes = jpegBytes(MAX_UPLOAD_BYTES + 1);
    await expect(
      storeUpload(env, {
        bytes,
        filename: 'group.jpg',
        contentType: 'image/jpeg',
        uploaderEmail: UPLOADER,
      }),
    ).rejects.toMatchObject({ status: 413 });
  });

  it('rejects a disallowed content type with 400', async () => {
    await expect(
      storeUpload(env, {
        bytes: jpegBytes(),
        filename: 'group.gif',
        contentType: 'image/gif',
        uploaderEmail: UPLOADER,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a content type that disagrees with the magic bytes', async () => {
    // Declared image/png, actual JPEG bytes.
    await expect(
      storeUpload(env, {
        bytes: jpegBytes(),
        filename: 'group.png',
        contentType: 'image/png',
        uploaderEmail: UPLOADER,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a script renamed to .jpg', async () => {
    await expect(
      storeUpload(env, {
        bytes: scriptBytes(),
        filename: 'totally-a-photo.jpg',
        contentType: 'image/jpeg',
        uploaderEmail: UPLOADER,
      }),
    ).rejects.toBeInstanceOf(UploadError);
    await expect(
      storeUpload(env, {
        bytes: scriptBytes(),
        filename: 'totally-a-photo.jpg',
        contentType: 'image/jpeg',
        uploaderEmail: UPLOADER,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('stores under the private prefix and never the public one', async () => {
    const row = await storeUpload(env, {
      bytes: jpegBytes(),
      filename: 'group.jpg',
      contentType: 'image/jpeg',
      uploaderEmail: UPLOADER,
    });

    expect(row.status).toBe('private');

    const privateObject = await env.MEDIA.get(`private/${row.key}`);
    expect(privateObject).not.toBeNull();

    const publicObject = await env.MEDIA.get(`public/${row.key}`);
    expect(publicObject).toBeNull();
  });

  it('a stored upload is not retrievable via getPublicObject', async () => {
    const row = await storeUpload(env, {
      bytes: jpegBytes(),
      filename: 'group.jpg',
      contentType: 'image/jpeg',
      uploaderEmail: UPLOADER,
    });

    const result = await getPublicObject(env, row.key);
    expect(result).toBeNull();
  });

  it('publishMedia copies to public and flips status', async () => {
    const row = await storeUpload(env, {
      bytes: pngBytes(),
      filename: 'group.png',
      contentType: 'image/png',
      uploaderEmail: UPLOADER,
    });

    const published = await publishMedia(env, row.key, EDITOR);

    expect(published.status).toBe('public');
    expect(published.published_by).toBe(EDITOR);
    expect(typeof published.published_at).toBe('number');

    const publicObject = await env.MEDIA.get(`public/${row.key}`);
    expect(publicObject).not.toBeNull();
  });

  it('after publish, getPublicObject returns the object', async () => {
    const row = await storeUpload(env, {
      bytes: webpBytes(),
      filename: 'group.webp',
      contentType: 'image/webp',
      uploaderEmail: UPLOADER,
    });
    await publishMedia(env, row.key, EDITOR);

    const result = await getPublicObject(env, row.key);
    expect(result).not.toBeNull();
  });

  it('unpublishMedia removes the public object and flips status back', async () => {
    const row = await storeUpload(env, {
      bytes: jpegBytes(),
      filename: 'group.jpg',
      contentType: 'image/jpeg',
      uploaderEmail: UPLOADER,
    });
    await publishMedia(env, row.key, EDITOR);

    const unpublished = await unpublishMedia(env, row.key, EDITOR);

    expect(unpublished.status).toBe('private');

    const publicObject = await env.MEDIA.get(`public/${row.key}`);
    expect(publicObject).toBeNull();
  });

  it('after unpublish, getPublicObject returns null again', async () => {
    const row = await storeUpload(env, {
      bytes: jpegBytes(),
      filename: 'group.jpg',
      contentType: 'image/jpeg',
      uploaderEmail: UPLOADER,
    });
    await publishMedia(env, row.key, EDITOR);
    await unpublishMedia(env, row.key, EDITOR);

    const result = await getPublicObject(env, row.key);
    expect(result).toBeNull();
  });

  it('getPublicObject returns null when the R2 object exists in public/ but the row says private', async () => {
    // Simulate the exact partial-failure scenario the brief warns about:
    // an orphaned object sitting in public/ with no corresponding
    // published row. Write directly to R2, bypassing storeUpload/
    // publishMedia entirely, and insert a row that stays private.
    const key = 'orphan-test-key.jpg';
    await env.MEDIA.put(`public/${key}`, jpegBytes());
    await env.DB.prepare(
      `INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(key, 'orphan.jpg', 'image/jpeg', 32, UPLOADER).run();

    const result = await getPublicObject(env, key);
    expect(result).toBeNull();
  });

  it('a filename containing ../ cannot escape the key prefix', async () => {
    const row = await storeUpload(env, {
      bytes: jpegBytes(),
      filename: '../../etc/passwd.jpg',
      contentType: 'image/jpeg',
      uploaderEmail: UPLOADER,
    });

    // The generated key must never contain path-traversal segments, and
    // the object must be reachable only under private/<key> — proving the
    // filename was never used to build the storage path.
    expect(row.key).not.toContain('..');
    expect(row.key).not.toContain('/');

    const privateObject = await env.MEDIA.get(`private/${row.key}`);
    expect(privateObject).not.toBeNull();

    // Original filename is preserved for display only, never used as a path.
    expect(row.filename).toBe('../../etc/passwd.jpg');
  });

  it('listMedia filters by status', async () => {
    const a = await storeUpload(env, {
      bytes: jpegBytes(),
      filename: 'a.jpg',
      contentType: 'image/jpeg',
      uploaderEmail: UPLOADER,
    });
    await storeUpload(env, {
      bytes: pngBytes(),
      filename: 'b.png',
      contentType: 'image/png',
      uploaderEmail: UPLOADER,
    });
    await publishMedia(env, a.key, EDITOR);

    const publicRows = await listMedia(env.DB, { status: 'public' });
    const privateRows = await listMedia(env.DB, { status: 'private' });

    expect(publicRows).toHaveLength(1);
    expect(publicRows[0].key).toBe(a.key);
    expect(privateRows).toHaveLength(1);
  });

  it('rolls back the R2 write if the DB insert fails', async () => {
    // Stub crypto.randomUUID to a fixed value and pre-insert a `media` row
    // with that exact key directly via SQL (bypassing storeUpload/R2), so
    // storeUpload's own R2 write is the first and only object at that key
    // — its insert then fails on the UNIQUE constraint against the
    // pre-existing row, without the write itself ever colliding with a
    // prior R2 object. This isolates the orphan-cleanup path: the object
    // storeUpload just wrote must be deleted, not left behind, when its
    // own insert fails.
    const fixedUuid = '11111111-1111-4111-8111-111111111111';
    const collidingKey = `${fixedUuid}.jpg`;

    await env.DB.prepare(
      `INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(collidingKey, 'preexisting.jpg', 'image/jpeg', 1, UPLOADER).run();

    const originalRandomUUID = crypto.randomUUID;
    crypto.randomUUID = () => fixedUuid;

    try {
      await expect(
        storeUpload(env, {
          bytes: jpegBytes(),
          filename: 'second.jpg',
          contentType: 'image/jpeg',
          uploaderEmail: UPLOADER,
        }),
      ).rejects.toThrow();
    } finally {
      crypto.randomUUID = originalRandomUUID;
    }

    // storeUpload's own write (which briefly existed at the same key,
    // shadowing nothing real since the pre-existing row never had an R2
    // object) must have been deleted by the rollback — no orphan remains.
    const privateObject = await env.MEDIA.get(`private/${collidingKey}`);
    expect(privateObject).toBeNull();

    // Exactly the pre-existing row remains; the failed second insert
    // never took effect.
    const stillOne = await listMedia(env.DB, { status: 'private' });
    expect(stillOne).toHaveLength(1);
    expect(stillOne[0].filename).toBe('preexisting.jpg');
  });
});
