import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

describe('schema', () => {
  it('stores a user with permission flags', async () => {
    await env.DB.prepare(
      `INSERT INTO users (email, name, can_blog, is_admin)
       VALUES (?, ?, 1, 1)`,
    ).bind('ken@example.com', 'Ken').run();

    const row = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?',
    ).bind('ken@example.com').first();

    expect(row.name).toBe('Ken');
    expect(row.can_blog).toBe(1);
    expect(row.can_media).toBe(0);
    expect(row.is_admin).toBe(1);
    expect(typeof row.created_at).toBe('number');
  });

  it('rejects a duplicate email', async () => {
    await env.DB.prepare('INSERT INTO users (email) VALUES (?)')
      .bind('dup@example.com').run();

    await expect(
      env.DB.prepare('INSERT INTO users (email) VALUES (?)')
        .bind('dup@example.com').run(),
    ).rejects.toThrow();
  });

  it('records an audit entry', async () => {
    await env.DB.prepare(
      `INSERT INTO audit_log (actor_email, action, detail)
       VALUES (?, ?, ?)`,
    ).bind('ken@example.com', 'user.create', 'sarah@example.com').run();

    const row = await env.DB.prepare(
      'SELECT * FROM audit_log WHERE actor_email = ?',
    ).bind('ken@example.com').first();

    expect(row.action).toBe('user.create');
  });
});
