import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

describe('media schema', () => {
  it('defaults a new row to private', async () => {
    await env.DB.prepare(
      `INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind('abc123.jpg', 'group.jpg', 'image/jpeg', 1024, 'ken@example.com').run();

    const row = await env.DB.prepare('SELECT * FROM media WHERE key = ?')
      .bind('abc123.jpg').first();

    expect(row.status).toBe('private');
    expect(row.published_at).toBeNull();
    expect(typeof row.uploaded_at).toBe('number');
  });

  it('rejects a duplicate key', async () => {
    await env.DB.prepare(
      'INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by) VALUES (?,?,?,?,?)',
    ).bind('dup.jpg', 'a.jpg', 'image/jpeg', 1, 'a@b.com').run();

    await expect(
      env.DB.prepare(
        'INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by) VALUES (?,?,?,?,?)',
      ).bind('dup.jpg', 'b.jpg', 'image/jpeg', 1, 'a@b.com').run(),
    ).rejects.toThrow();
  });

  it('records who published and when', async () => {
    await env.DB.prepare(
      'INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by) VALUES (?,?,?,?,?)',
    ).bind('pub.jpg', 'p.jpg', 'image/jpeg', 1, 'ken@example.com').run();

    await env.DB.prepare(
      `UPDATE media SET status = 'public', published_at = unixepoch(),
       published_by = ? WHERE key = ?`,
    ).bind('sarah@example.com', 'pub.jpg').run();

    const row = await env.DB.prepare('SELECT * FROM media WHERE key = ?')
      .bind('pub.jpg').first();
    expect(row.status).toBe('public');
    expect(row.published_by).toBe('sarah@example.com');
    expect(typeof row.published_at).toBe('number');
  });
});
