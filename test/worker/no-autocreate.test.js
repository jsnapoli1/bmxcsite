import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { loadUser } from '../../worker/auth/permissions.js';

/**
 * Cloudflare Access lets a person through the door; the users table decides
 * what they may do. If a failed lookup ever created a row, everyone Access
 * admits would silently become a user. The code is read-only today — these
 * tests exist so it stays that way.
 */
describe('loadUser never creates a user', () => {
  it('leaves the table empty after a miss', async () => {
    const before = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    expect(before.n).toBe(0);

    expect(await loadUser(env.DB, 'stranger@example.com')).toBeNull();

    const after = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    expect(after.n).toBe(0);
  });

  it('does not create a row after repeated misses', async () => {
    for (const email of ['a@x.com', 'b@x.com', 'a@x.com']) {
      expect(await loadUser(env.DB, email)).toBeNull();
    }
    const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    expect(n).toBe(0);
  });

  it('does not modify an existing row', async () => {
    await env.DB.prepare(
      'INSERT INTO users (email, name, can_blog) VALUES (?, ?, 1)',
    ).bind('real@example.com', 'Real').run();

    await loadUser(env.DB, 'real@example.com');
    await loadUser(env.DB, 'REAL@EXAMPLE.COM');

    const row = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?',
    ).bind('real@example.com').first();
    expect(row.name).toBe('Real');
    expect(row.can_blog).toBe(1);
    expect(row.can_media).toBe(0);
    expect(row.is_admin).toBe(0);

    const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    expect(n).toBe(1);
  });
});
