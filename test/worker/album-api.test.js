import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';

// Same shape as test/worker/media-api.test.js: Access verification is
// mocked, the permission check under test is the real one.
function asUser(email) {
  vi.spyOn(jwt, 'verifyAccessJwt').mockResolvedValue(email);
}

async function seedUser(email, { media = false } = {}) {
  await env.DB.prepare(
    'INSERT INTO users (email, can_media) VALUES (?, ?)',
  ).bind(email, media ? 1 : 0).run();
  return email;
}

async function call(method, path, body) {
  return app.fetch(
    new Request(`https://bmxc.camp${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );
}

async function seedMedia(key, albumId = null) {
  await env.DB.prepare(
    `INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by, album_id)
     VALUES (?, 'p.jpg', 'image/jpeg', 10, 'a@b.c', ?)`,
  ).bind(key, albumId).run();
}

describe('album routes', () => {
  it('creates an album for someone holding media', async () => {
    asUser(await seedUser('m1@example.com', { media: true }));
    const res = await call('POST', '/api/admin/media/albums', { title: 'Session 1' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.album.slug).toBe('session-1');
  });

  it('refuses someone without the media permission', async () => {
    asUser(await seedUser('no@example.com', { media: false }));
    const res = await call('POST', '/api/admin/media/albums', { title: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('refuses a blank title with 400, not 500', async () => {
    asUser(await seedUser('m2@example.com', { media: true }));
    const res = await call('POST', '/api/admin/media/albums', { title: '  ' });
    expect(res.status).toBe(400);
  });

  it('lists albums with their counts', async () => {
    asUser(await seedUser('m3@example.com', { media: true }));
    const created = await call('POST', '/api/admin/media/albums', { title: 'Listed' });
    const { album } = await created.json();
    await seedMedia('list-1.jpg', album.id);

    const res = await call('GET', '/api/admin/media/albums');
    expect(res.status).toBe(200);
    const { albums } = await res.json();
    expect(albums.find((a) => a.id === album.id).item_count).toBe(1);
  });

  it('moving a photo between albums never publishes it', async () => {
    asUser(await seedUser('m4@example.com', { media: true }));
    await seedMedia('mv.jpg');
    const created = await call('POST', '/api/admin/media/albums', { title: 'Dest' });
    const { album } = await created.json();

    const res = await call('PUT', '/api/admin/media/mv.jpg/album', { albumId: album.id });
    expect(res.status).toBe(200);
    const { media } = await res.json();
    expect(media.album_id).toBe(album.id);
    expect(media.status).toBe('private');
  });

  it('deleting an album keeps its photographs', async () => {
    asUser(await seedUser('m5@example.com', { media: true }));
    const created = await call('POST', '/api/admin/media/albums', { title: 'Doomed' });
    const { album } = await created.json();
    await seedMedia('keep.jpg', album.id);

    const res = await call('DELETE', `/api/admin/media/albums/${album.id}`);
    expect(res.status).toBe(200);

    const still = await env.DB.prepare("SELECT * FROM media WHERE key = 'keep.jpg'").first();
    expect(still).not.toBeNull();
    expect(still.album_id).toBeNull();
  });

  it('does not treat "albums" as a media key', async () => {
    // /albums is registered before /:key. Were it not, this GET would fall
    // through to the media routes and look up a photo called "albums".
    asUser(await seedUser('m6@example.com', { media: true }));
    const res = await call('GET', '/api/admin/media/albums');
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty('albums');
  });

  it('reports 404 for an album that is not there', async () => {
    asUser(await seedUser('m7@example.com', { media: true }));
    expect((await call('DELETE', '/api/admin/media/albums/99999')).status).toBe(404);
    expect((await call('PATCH', '/api/admin/media/albums/99999', { title: 'X' })).status).toBe(404);
  });
});
