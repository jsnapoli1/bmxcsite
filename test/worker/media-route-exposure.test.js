import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';
import { storeUpload, publishMedia } from '../../worker/media/repository.js';

const JPEG = new Uint8Array([0xFF,0xD8,0xFF,0xE0, ...new Array(64).fill(0x41)]);
const anon = (m,p) => app.fetch(new Request(`https://bmxc.camp${p}`, { method:m }), env);

async function uploaded() {
  return storeUpload(env, { bytes: JPEG, filename:'kid.jpg', contentType:'image/jpeg', uploaderEmail:'k@x.com' });
}

/**
 * `/media/:key` is the one publicly-reachable route that serves uploaded
 * bytes, and it sits outside Cloudflare Access by necessity — the public
 * site has to load images without signing in. Given some camp photos show
 * identifiable minors, these are the checks that matter most in the phase:
 * a private photo must never be served, and no anonymous caller may reach
 * a verb that could publish one.
 */
describe('public media route cannot leak a private photo', () => {
  it('a private photo is not served', async () => {
    vi.spyOn(jwt,'verifyAccessJwt').mockRejectedValue(new jwt.AuthError('none'));
    const row = await uploaded();
    const res = await anon('GET', `/media/${row.key}`);
    expect(res.status).toBe(404);
    const body = await res.text();
    // The 404 body must not contain photo bytes. JPEG magic is FF D8 FF; the
    // uploaded payload is a run of 'A' (0x41).
    expect(body).not.toContain('AAAA');
    expect(body.charCodeAt(0)).not.toBe(0xFF);
    expect(body).toBe('{"error":"Not found"}');
  });

  it('an unknown key is 404 not 500', async () => {
    expect((await anon('GET','/media/nope.jpg')).status).toBe(404);
  });

  it('every admin media verb denies an anonymous caller', async () => {
    vi.spyOn(jwt,'verifyAccessJwt').mockRejectedValue(new jwt.AuthError('none'));
    const row = await uploaded();
    const statuses = {};
    for (const [m,p] of [
      ['GET','/api/admin/media'],
      ['POST',`/api/admin/media/${row.key}/publish`],
      ['POST',`/api/admin/media/${row.key}/unpublish`],
      ['DELETE',`/api/admin/media/${row.key}`],
    ]) statuses[`${m} ${p.replace(row.key,'KEY')}`] = (await anon(m,p)).status;
    expect(Object.values(statuses).some(s => s>=200 && s<300)).toBe(false);
    // and the photo is still private afterwards
    expect((await anon('GET', `/media/${row.key}`)).status).toBe(404);
  });

  it('a published photo IS served, with immutable caching', async () => {
    const row = await uploaded();
    await publishMedia(env, row.key, 'k@x.com');
    const res = await anon('GET', `/media/${row.key}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(res.headers.get('content-type')).toBe('image/jpeg');
  });
});
