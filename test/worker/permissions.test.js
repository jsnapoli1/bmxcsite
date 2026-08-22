import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { loadUser, hasPermission, AREAS } from '../../worker/auth/permissions.js';

async function insertUser(email, flags = {}) {
  await env.DB.prepare(
    `INSERT INTO users (email, name, can_blog, can_media, can_merch,
       can_campinfo, is_admin)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    email,
    flags.name ?? null,
    flags.can_blog ?? 0,
    flags.can_media ?? 0,
    flags.can_merch ?? 0,
    flags.can_campinfo ?? 0,
    flags.is_admin ?? 0,
  ).run();
}

describe('loadUser', () => {
  it('returns null for an unknown email', async () => {
    expect(await loadUser(env.DB, 'nobody@example.com')).toBeNull();
  });

  it('maps database flags to booleans', async () => {
    await insertUser('editor@example.com', { name: 'Ed', can_blog: 1 });
    const user = await loadUser(env.DB, 'editor@example.com');
    expect(user.email).toBe('editor@example.com');
    expect(user.name).toBe('Ed');
    expect(user.permissions.blog).toBe(true);
    expect(user.permissions.media).toBe(false);
    expect(user.isAdmin).toBe(false);
  });

  it('is case-insensitive on email', async () => {
    await insertUser('mixed@example.com', { can_merch: 1 });
    const user = await loadUser(env.DB, 'Mixed@Example.COM');
    expect(user).not.toBeNull();
    expect(user.permissions.merch).toBe(true);
  });
});

describe('hasPermission', () => {
  it('denies a null user every area', () => {
    for (const area of AREAS) {
      expect(hasPermission(null, area)).toBe(false);
    }
  });

  it('grants only the flagged area', async () => {
    await insertUser('blogger@example.com', { can_blog: 1 });
    const user = await loadUser(env.DB, 'blogger@example.com');
    expect(hasPermission(user, 'blog')).toBe(true);
    expect(hasPermission(user, 'media')).toBe(false);
  });

  it('grants an admin every area', async () => {
    await insertUser('boss@example.com', { is_admin: 1 });
    const user = await loadUser(env.DB, 'boss@example.com');
    for (const area of AREAS) {
      expect(hasPermission(user, area)).toBe(true);
    }
  });

  it('denies an unknown area even for an admin', async () => {
    await insertUser('boss2@example.com', { is_admin: 1 });
    const user = await loadUser(env.DB, 'boss2@example.com');
    expect(hasPermission(user, 'billing')).toBe(false);
  });
});
