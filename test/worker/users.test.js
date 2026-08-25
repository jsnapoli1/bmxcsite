import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';

function asUser(email) {
  vi.spyOn(jwt, 'verifyAccessJwt').mockResolvedValue(email);
}

async function seedAdmin(email = 'admin@example.com') {
  await env.DB.prepare(
    'INSERT INTO users (email, is_admin) VALUES (?, 1)',
  ).bind(email).run();
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

describe('users API authorisation', () => {
  it('denies a non-admin', async () => {
    await env.DB.prepare(
      'INSERT INTO users (email, can_blog) VALUES (?, 1)',
    ).bind('editor@example.com').run();
    asUser('editor@example.com');

    expect((await call('GET', '/api/admin/users')).status).toBe(403);
    expect((await call('POST', '/api/admin/users',
      { email: 'x@example.com' })).status).toBe(403);
  });

  it('denies a non-admin on PATCH and DELETE against a real target', async () => {
    await env.DB.prepare(
      'INSERT INTO users (email, can_blog) VALUES (?, 1)',
    ).bind('target@example.com').run();
    await env.DB.prepare(
      'INSERT INTO users (email, can_blog) VALUES (?, 1)',
    ).bind('editor@example.com').run();
    asUser('editor@example.com');

    expect((await call('PATCH', '/api/admin/users/target@example.com',
      { isAdmin: true })).status).toBe(403);
    expect((await call('DELETE', '/api/admin/users/target@example.com'))
      .status).toBe(403);
  });

  it('denies an unregistered but verified email', async () => {
    asUser('stranger@example.com');
    expect((await call('GET', '/api/admin/users')).status).toBe(403);
  });
});

describe('users API', () => {
  it('lists users', async () => {
    const admin = await seedAdmin('list-admin@example.com');
    asUser(admin);
    const res = await call('GET', '/api/admin/users');
    expect(res.status).toBe(200);
    const { users } = await res.json();
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe(admin);
  });

  it('creates a user with the requested permissions', async () => {
    const admin = await seedAdmin('create-admin@example.com');
    asUser(admin);
    const res = await call('POST', '/api/admin/users', {
      email: 'New@Example.com',
      name: 'New Person',
      permissions: {
        blog: true, media: false, merch: false, campinfo: false, design: false,
      },
    });
    expect(res.status).toBe(201);
    const { user } = await res.json();
    expect(user.email).toBe('new@example.com');
    expect(user.permissions.blog).toBe(true);
    expect(user.isAdmin).toBe(false);
  });

  it('rejects an invalid email', async () => {
    const admin = await seedAdmin('invalid-email-admin@example.com');
    asUser(admin);
    const res = await call('POST', '/api/admin/users', { email: 'not-email' });
    expect(res.status).toBe(400);
  });

  it('rejects an email exceeding the RFC 5321 254-char practical maximum', async () => {
    const admin = await seedAdmin('long-email-admin@example.com');
    asUser(admin);
    const hugeLocalPart = 'a'.repeat(5000);
    const res = await call('POST', '/api/admin/users',
      { email: `${hugeLocalPart}@example.com` });
    expect(res.status).toBe(400);
  });

  it('accepts an email right at the 254-char boundary', async () => {
    const admin = await seedAdmin('boundary-email-admin@example.com');
    asUser(admin);
    // 254 chars total: local part sized so local + '@' + domain = 254.
    const domain = '@example.com';
    const localPart = 'a'.repeat(254 - domain.length);
    const email = `${localPart}${domain}`;
    expect(email).toHaveLength(254);

    const res = await call('POST', '/api/admin/users', { email });
    expect(res.status).toBe(201);
  });

  it('rejects a duplicate email', async () => {
    const admin = await seedAdmin('dupe-admin@example.com');
    asUser(admin);
    await call('POST', '/api/admin/users', { email: 'dupe@example.com' });
    const res = await call('POST', '/api/admin/users',
      { email: 'dupe@example.com' });
    expect(res.status).toBe(409);
  });

  it('updates permissions', async () => {
    const admin = await seedAdmin('update-admin@example.com');
    asUser(admin);
    await call('POST', '/api/admin/users', { email: 'p@example.com' });
    const res = await call('PATCH', '/api/admin/users/p@example.com', {
      permissions: { blog: false, media: true, merch: false, campinfo: false },
    });
    expect(res.status).toBe(200);
    const { user } = await res.json();
    expect(user.permissions.media).toBe(true);
  });

  it('leaves omitted permissions untouched on a partial PATCH', async () => {
    const admin = await seedAdmin('partial-admin@example.com');
    asUser(admin);
    await call('POST', '/api/admin/users', {
      email: 'full@example.com',
      permissions: {
        blog: true, media: true, merch: true, campinfo: true, design: true,
      },
    });

    const res = await call('PATCH', '/api/admin/users/full@example.com', {
      permissions: { blog: true },
    });
    expect(res.status).toBe(200);
    const { user } = await res.json();
    expect(user.permissions).toEqual({
      blog: true, media: true, merch: true, campinfo: true, design: true,
    });
  });

  it('clears a permission when it is explicitly set to false', async () => {
    const admin = await seedAdmin('explicit-false-admin@example.com');
    asUser(admin);
    await call('POST', '/api/admin/users', {
      email: 'clearone@example.com',
      permissions: {
        blog: true, media: true, merch: true, campinfo: true, design: true,
      },
    });

    const res = await call('PATCH', '/api/admin/users/clearone@example.com', {
      permissions: { media: false },
    });
    expect(res.status).toBe(200);
    const { user } = await res.json();
    expect(user.permissions).toEqual({
      blog: true, media: false, merch: true, campinfo: true, design: true,
    });
  });

  it('still replaces every permission when a full object is sent', async () => {
    const admin = await seedAdmin('full-patch-admin@example.com');
    asUser(admin);
    await call('POST', '/api/admin/users', {
      email: 'replaceall@example.com',
      permissions: {
        blog: true, media: true, merch: true, campinfo: true, design: true,
      },
    });

    const res = await call('PATCH', '/api/admin/users/replaceall@example.com', {
      permissions: {
        blog: false, media: false, merch: false, campinfo: false, design: false,
      },
    });
    expect(res.status).toBe(200);
    const { user } = await res.json();
    expect(user.permissions).toEqual({
      blog: false, media: false, merch: false, campinfo: false, design: false,
    });
  });

  it('deletes a user', async () => {
    const admin = await seedAdmin('delete-admin@example.com');
    asUser(admin);
    await call('POST', '/api/admin/users', { email: 'gone@example.com' });
    expect((await call('DELETE', '/api/admin/users/gone@example.com')).status)
      .toBe(200);
    const res = await call('GET', '/api/admin/users');
    const { users } = await res.json();
    expect(users.map((u) => u.email)).not.toContain('gone@example.com');
  });

  it('refuses to let an admin remove their own admin flag', async () => {
    const admin = await seedAdmin('lockout-admin@example.com');
    asUser(admin);
    const res = await call('PATCH', `/api/admin/users/${admin}`,
      { isAdmin: false });
    expect(res.status).toBe(400);
  });

  describe('self-demotion guard rejects any non-true isAdmin, not just false', () => {
    const cases = [
      ['isAdmin: 0', 0],
      ['isAdmin: "false" (truthy string)', 'false'],
      ['isAdmin: [] (truthy array)', []],
      ['isAdmin: {} (truthy object)', {}],
      ['isAdmin: null', null],
    ];

    for (const [label, value] of cases) {
      it(`refuses self-PATCH with ${label}`, async () => {
        const admin = await seedAdmin(`selfguard-${Math.random().toString(36).slice(2)}@example.com`);
        asUser(admin);
        const res = await call('PATCH', `/api/admin/users/${admin}`,
          { isAdmin: value });
        expect(res.status).toBe(400);

        // The account must still be admin afterward — the guard is the
        // only thing standing between a truthy-junk payload and a
        // permanent lockout.
        const row = await env.DB.prepare(
          'SELECT is_admin FROM users WHERE email = ?',
        ).bind(admin).first();
        expect(row.is_admin).toBe(1);
      });
    }
  });

  it('does not grant admin from a truthy non-boolean isAdmin on another user', async () => {
    const admin = await seedAdmin('grant-guard-admin@example.com');
    asUser(admin);
    await call('POST', '/api/admin/users', { email: 'grant-target@example.com' });

    const res = await call('PATCH', '/api/admin/users/grant-target@example.com',
      { isAdmin: 'false' });
    expect(res.status).toBe(200);
    const { user } = await res.json();
    expect(user.isAdmin).toBe(false);
  });

  it('does not grant a permission from truthy non-boolean values on another user', async () => {
    const admin = await seedAdmin('grant-perm-guard-admin@example.com');
    asUser(admin);
    await call('POST', '/api/admin/users', { email: 'grant-perm-target@example.com' });

    const res = await call('PATCH', '/api/admin/users/grant-perm-target@example.com', {
      permissions: { blog: 'false', media: [], merch: {}, campinfo: 1 },
    });
    expect(res.status).toBe(200);
    const { user } = await res.json();
    expect(user.permissions).toEqual({
      blog: false, media: false, merch: false, campinfo: false, design: false,
    });
  });

  it('preserves existing isAdmin=true when a self-PATCH omits isAdmin', async () => {
    const admin = await seedAdmin('preserve-admin-true@example.com');
    asUser(admin);
    const res = await call('PATCH', `/api/admin/users/${admin}`,
      { name: 'Renamed' });
    expect(res.status).toBe(200);
    const { user } = await res.json();
    expect(user.isAdmin).toBe(true);
  });

  it('preserves existing isAdmin=false when a PATCH omits isAdmin', async () => {
    const admin = await seedAdmin('preserve-nonadmin-owner@example.com');
    asUser(admin);
    await call('POST', '/api/admin/users', { email: 'nonadmin-target@example.com' });

    const res = await call('PATCH', '/api/admin/users/nonadmin-target@example.com',
      { permissions: { blog: true } });
    expect(res.status).toBe(200);
    const { user } = await res.json();
    expect(user.isAdmin).toBe(false);
  });

  it('refuses to let an admin delete themselves', async () => {
    const admin = await seedAdmin('selfdelete-admin@example.com');
    asUser(admin);
    const res = await call('DELETE', `/api/admin/users/${admin}`);
    expect(res.status).toBe(400);
  });

  it('refuses self-deletion even when the URL email differs in case', async () => {
    const admin = await seedAdmin('case-admin@example.com');
    asUser('case-admin@example.com');
    const res = await call('DELETE', '/api/admin/users/CASE-ADMIN@EXAMPLE.COM');
    expect(res.status).toBe(400);
    // The admin must still exist afterward — a case-sensitive comparison
    // would have let this DELETE fall through and remove the account.
    const check = await env.DB.prepare('SELECT email FROM users WHERE email = ?')
      .bind(admin).first();
    expect(check).not.toBeNull();
  });

  it('writes an audit entry when creating a user', async () => {
    const admin = await seedAdmin('audit-admin@example.com');
    asUser(admin);
    await call('POST', '/api/admin/users', { email: 'audited@example.com' });
    const row = await env.DB.prepare(
      'SELECT * FROM audit_log WHERE action = ? AND detail = ?',
    ).bind('user.create', 'audited@example.com').first();
    expect(row.actor_email).toBe(admin);
    expect(row.detail).toContain('audited@example.com');
  });

  it('writes an audit entry when updating a user', async () => {
    const admin = await seedAdmin('audit-update-admin@example.com');
    asUser(admin);
    await call('POST', '/api/admin/users', { email: 'audited-update@example.com' });
    await call('PATCH', '/api/admin/users/audited-update@example.com',
      { permissions: { blog: true } });

    const row = await env.DB.prepare(
      'SELECT * FROM audit_log WHERE action = ? AND detail LIKE ?',
    ).bind('user.update', 'audited-update@example.com%').first();
    expect(row.actor_email).toBe(admin);
    expect(row.detail).toContain('audited-update@example.com');
  });

  it('records the resulting permissions and admin state in the update audit detail', async () => {
    const admin = await seedAdmin('audit-detail-admin@example.com');
    asUser(admin);
    await call('POST', '/api/admin/users', { email: 'audit-detail@example.com' });
    await call('PATCH', '/api/admin/users/audit-detail@example.com', {
      permissions: {
        blog: true, media: false, merch: false, campinfo: false, design: false,
      },
      isAdmin: false,
    });

    const row = await env.DB.prepare(
      'SELECT * FROM audit_log WHERE action = ? AND detail LIKE ?',
    ).bind('user.update', 'audit-detail@example.com%').first();
    expect(row.detail).toContain('audit-detail@example.com');

    const [, jsonPart] = row.detail.split(/ (.+)/s);
    const parsed = JSON.parse(jsonPart);
    expect(parsed).toEqual({
      permissions: {
        blog: true, media: false, merch: false, campinfo: false, design: false,
      },
      isAdmin: false,
    });
  });

  it('writes an audit entry when deleting a user', async () => {
    const admin = await seedAdmin('audit-delete-admin@example.com');
    asUser(admin);
    await call('POST', '/api/admin/users', { email: 'audited-delete@example.com' });
    await call('DELETE', '/api/admin/users/audited-delete@example.com');

    const row = await env.DB.prepare(
      'SELECT * FROM audit_log WHERE action = ? AND detail = ?',
    ).bind('user.delete', 'audited-delete@example.com').first();
    expect(row.actor_email).toBe(admin);
    expect(row.detail).toContain('audited-delete@example.com');
  });

  it('returns 409, not 500, when a duplicate slips past the pre-check', async () => {
    // Simulates the race the pre-check cannot close: the SELECT sees no row
    // (stubbed to miss, standing in for a concurrent request winning the
    // race), but the INSERT still hits a real UNIQUE-constraint violation
    // because the row already exists. The route must translate that D1
    // error into the same 409 the pre-check returns, not let it surface as
    // a 500 with a raw database message.
    const admin = await seedAdmin('race-admin@example.com');
    asUser(admin);

    await env.DB.prepare('INSERT INTO users (email) VALUES (?)')
      .bind('raced@example.com').run();

    const realPrepare = env.DB.prepare.bind(env.DB);
    const prepareSpy = vi.spyOn(env.DB, 'prepare').mockImplementation((sql) => {
      if (sql.includes('SELECT email FROM users WHERE email = ?')) {
        return { bind: () => ({ first: async () => null }) };
      }
      return realPrepare(sql);
    });

    try {
      const res = await call('POST', '/api/admin/users', { email: 'raced@example.com' });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe('That person already has access');
    } finally {
      prepareSpy.mockRestore();
    }
  });
});
