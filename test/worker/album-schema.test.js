import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

describe('albums schema', () => {
  it('stores an album and returns it by slug', async () => {
    await env.DB.prepare(
      "INSERT INTO albums (slug, title, created_by) VALUES ('2026-session-1', 'Session 1', 'a@b.c')",
    ).run();
    const row = await env.DB.prepare(
      "SELECT * FROM albums WHERE slug = '2026-session-1'",
    ).first();
    expect(row.title).toBe('Session 1');
    expect(row.created_at).toBeGreaterThan(0);
  });

  it('refuses two albums with the same slug', async () => {
    await env.DB.prepare(
      "INSERT INTO albums (slug, title, created_by) VALUES ('dup', 'One', 'a@b.c')",
    ).run();
    await expect(
      env.DB.prepare(
        "INSERT INTO albums (slug, title, created_by) VALUES ('dup', 'Two', 'a@b.c')",
      ).run(),
    ).rejects.toThrow();
  });

  it('lets media belong to no album', async () => {
    await env.DB.prepare(
      `INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by)
       VALUES ('k-none.jpg', 'p.jpg', 'image/jpeg', 10, 'a@b.c')`,
    ).run();
    const row = await env.DB.prepare("SELECT album_id FROM media WHERE key = 'k-none.jpg'").first();
    expect(row.album_id).toBeNull();
  });

  it('detaches media instead of deleting it when its album goes', async () => {
    // A director deleting an album must not delete the photographs in it.
    // Losing an organisational grouping is recoverable; losing the only
    // copy of a camp photo is not.
    const album = await env.DB.prepare(
      "INSERT INTO albums (slug, title, created_by) VALUES ('temp', 'Temp', 'a@b.c') RETURNING id",
    ).first();
    await env.DB.prepare(
      `INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by, album_id)
       VALUES ('k-att.jpg', 'p.jpg', 'image/jpeg', 10, 'a@b.c', ?)`,
    ).bind(album.id).run();

    await env.DB.prepare('DELETE FROM albums WHERE id = ?').bind(album.id).run();

    const row = await env.DB.prepare("SELECT album_id FROM media WHERE key = 'k-att.jpg'").first();
    expect(row).not.toBeNull();
    expect(row.album_id).toBeNull();
  });
});
