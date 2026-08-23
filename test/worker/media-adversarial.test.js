import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { storeUpload, publishMedia, getPublicObject, unpublishMedia } from '../../worker/media/repository.js';

const JPEG = new Uint8Array([0xFF,0xD8,0xFF,0xE0, ...new Array(64).fill(0x41)]);
const PNG  = new Uint8Array([0x89,0x50,0x4E,0x47, ...new Array(64).fill(0x42)]);

async function upload(over = {}) {
  return storeUpload(env, {
    bytes: JPEG, filename: 'photo.jpg', contentType: 'image/jpeg',
    uploaderEmail: 'ken@bmxc.camp', ...over,
  });
}

/**
 * This site is about children, and CLAUDE.md notes some camp photos show
 * individually identifiable minors. These are the checks that make an
 * accidental exposure require a deliberate, attributable action:
 *
 *   - the DATABASE decides what is public, not the presence of an R2 object,
 *     so an orphan left in public/ by a partial failure stays unreachable;
 *   - an upload is never public on arrival;
 *   - a file is what its bytes say, not what its Content-Type claims;
 *   - a filename never becomes part of a storage path.
 */
describe('adversarial media checks', () => {
  it('an HTML page renamed .jpg is refused', async () => {
    const html = new TextEncoder().encode('<html><script>alert(1)</script></html>');
    await expect(upload({ bytes: html })).rejects.toMatchObject({ status: 400 });
  });

  it('an SVG (a real XSS vector) is refused even though it is an image', async () => {
    const svg = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
    await expect(upload({ bytes: svg, contentType: 'image/svg+xml' }))
      .rejects.toMatchObject({ status: 400 });
  });

  it('declared PNG with JPEG bytes is refused', async () => {
    await expect(upload({ bytes: JPEG, contentType: 'image/png' }))
      .rejects.toMatchObject({ status: 400 });
  });

  it('a traversal filename cannot shape the stored key', async () => {
    const row = await upload({ filename: '../../etc/passwd.jpg' });
    expect(row.key).not.toContain('..');
    expect(row.key).not.toContain('/');
    expect(row.filename).toBe('../../etc/passwd.jpg'); // kept for display only
  });

  it('an uploaded photo is NOT publicly reachable', async () => {
    const row = await upload();
    expect(await getPublicObject(env, row.key)).toBeNull();
  });

  it('an orphan in public/ with a private row stays unreachable', async () => {
    const row = await upload();
    await env.MEDIA.put(`public/${row.key}`, PNG);   // simulate a partial failure
    expect(await getPublicObject(env, row.key)).toBeNull();
  });

  it('publish then unpublish makes it unreachable again', async () => {
    const row = await upload();
    await publishMedia(env, row.key, 'ken@bmxc.camp');
    expect(await getPublicObject(env, row.key)).not.toBeNull();
    await unpublishMedia(env, row.key, 'ken@bmxc.camp');
    expect(await getPublicObject(env, row.key)).toBeNull();
  });

  it('an unknown key is not served', async () => {
    expect(await getPublicObject(env, 'no-such-key.jpg')).toBeNull();
  });
});
