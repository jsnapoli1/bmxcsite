import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import {
  listAlbums, createAlbum, updateAlbum, deleteAlbum, setMediaAlbum, AlbumError,
} from '../../worker/media/albums.js';

async function seedMedia(key, albumId = null) {
  await env.DB.prepare(
    `INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by, album_id)
     VALUES (?, 'p.jpg', 'image/jpeg', 10, 'a@b.c', ?)`,
  ).bind(key, albumId).run();
}

describe('createAlbum', () => {
  it('derives a slug from the title', async () => {
    const row = await createAlbum(env.DB, { title: 'Session One 2026', creatorEmail: 'a@b.c' });
    expect(row.slug).toBe('session-one-2026');
  });

  it('makes a second album with the same title unique', async () => {
    await createAlbum(env.DB, { title: 'Camp Week', creatorEmail: 'a@b.c' });
    const second = await createAlbum(env.DB, { title: 'Camp Week', creatorEmail: 'a@b.c' });
    expect(second.slug).not.toBe('camp-week');
    expect(second.slug.startsWith('camp-week')).toBe(true);
  });

  it('refuses a blank title', async () => {
    await expect(
      createAlbum(env.DB, { title: '   ', creatorEmail: 'a@b.c' }),
    ).rejects.toThrow(AlbumError);
  });

  it('refuses a title that would slugify to nothing', async () => {
    // '///' has no slug characters. Without this the album would get an
    // empty slug, and the second such album would collide on UNIQUE.
    await expect(
      createAlbum(env.DB, { title: '///', creatorEmail: 'a@b.c' }),
    ).rejects.toThrow(AlbumError);
  });
});

describe('listAlbums', () => {
  it('counts the media in each album', async () => {
    const album = await createAlbum(env.DB, { title: 'Counted', creatorEmail: 'a@b.c' });
    await seedMedia('c1.jpg', album.id);
    await seedMedia('c2.jpg', album.id);

    const rows = await listAlbums(env.DB);
    const found = rows.find((r) => r.id === album.id);
    expect(found.item_count).toBe(2);
  });

  it('reports zero for an empty album rather than omitting it', async () => {
    const album = await createAlbum(env.DB, { title: 'Empty One', creatorEmail: 'a@b.c' });
    const rows = await listAlbums(env.DB);
    const found = rows.find((r) => r.id === album.id);
    expect(found).toBeDefined();
    expect(found.item_count).toBe(0);
  });
});

describe('setMediaAlbum', () => {
  it('moves a photo into an album', async () => {
    const album = await createAlbum(env.DB, { title: 'Target', creatorEmail: 'a@b.c' });
    await seedMedia('m1.jpg');
    const row = await setMediaAlbum(env.DB, 'm1.jpg', album.id);
    expect(row.album_id).toBe(album.id);
  });

  it('takes a photo out of every album with null', async () => {
    const album = await createAlbum(env.DB, { title: 'Leaving', creatorEmail: 'a@b.c' });
    await seedMedia('m2.jpg', album.id);
    const row = await setMediaAlbum(env.DB, 'm2.jpg', null);
    expect(row.album_id).toBeNull();
  });

  it('cannot change what is public', async () => {
    // Albums are organisational. Moving a photo between them must not be a
    // second path to publishing, which is publishMedia's job alone.
    const album = await createAlbum(env.DB, { title: 'Not A Gate', creatorEmail: 'a@b.c' });
    await seedMedia('m3.jpg');
    const row = await setMediaAlbum(env.DB, 'm3.jpg', album.id);
    expect(row.status).toBe('private');
  });

  it('returns null for a key that does not exist', async () => {
    expect(await setMediaAlbum(env.DB, 'nope.jpg', null)).toBeNull();
  });
});

describe('deleteAlbum', () => {
  it('keeps the media and clears its album', async () => {
    const album = await createAlbum(env.DB, { title: 'Doomed', creatorEmail: 'a@b.c' });
    await seedMedia('d1.jpg', album.id);

    expect(await deleteAlbum(env.DB, album.id)).toBe(true);

    const media = await env.DB.prepare("SELECT * FROM media WHERE key = 'd1.jpg'").first();
    expect(media).not.toBeNull();
    expect(media.album_id).toBeNull();
  });

  it('reports false for an album that is not there', async () => {
    expect(await deleteAlbum(env.DB, 99999)).toBe(false);
  });
});

describe('updateAlbum', () => {
  it('changes the title without changing the slug', async () => {
    // The slug is the stable handle. Renaming an album for clarity should
    // not silently repoint anything that referenced the old slug.
    const album = await createAlbum(env.DB, { title: 'Before', creatorEmail: 'a@b.c' });
    const row = await updateAlbum(env.DB, album.id, { title: 'After' });
    expect(row.title).toBe('After');
    expect(row.slug).toBe('before');
  });

  it('returns null for an album that is not there', async () => {
    expect(await updateAlbum(env.DB, 99999, { title: 'X' })).toBeNull();
  });
});
