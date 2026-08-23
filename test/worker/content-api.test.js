import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';

function asUser(email) {
  vi.spyOn(jwt, 'verifyAccessJwt').mockResolvedValue(email);
}

async function seedUser(email, permissions = {}, isAdmin = false) {
  await env.DB.prepare(
    `INSERT INTO users (email, can_blog, can_media, can_merch, can_campinfo, is_admin)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    email,
    permissions.blog ? 1 : 0,
    permissions.media ? 1 : 0,
    permissions.merch ? 1 : 0,
    permissions.campinfo ? 1 : 0,
    isAdmin ? 1 : 0,
  ).run();
  return email;
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

const STAFF_PAYLOAD = {
  groups: [
    { group: 'Directors', members: [{ name: 'Ken', role: 'Director', bio: 'b' }] },
  ],
};

const MERCH_PAYLOAD = {
  items: [{ id: 'hoodie', name: 'Hoodie', hero: true }],
  facts: [],
};

describe('content API authorisation', () => {
  it('denies GET /api/admin/content/staff without the campinfo permission', async () => {
    await seedUser('merch-only@example.com', { merch: true });
    asUser('merch-only@example.com');

    const res = await call('GET', '/api/admin/content/staff');
    expect(res.status).toBe(403);
  });

  it('denies PUT /api/admin/content/staff to a merch-only editor', async () => {
    await seedUser('merch-only-put@example.com', { merch: true });
    asUser('merch-only-put@example.com');

    const res = await call('PUT', '/api/admin/content/staff', STAFF_PAYLOAD);
    expect(res.status).toBe(403);
  });

  it('denies publish to a user lacking the area', async () => {
    await seedUser('nopublish@example.com', { merch: true });
    asUser('nopublish@example.com');

    const res = await call('POST', '/api/admin/content/staff/publish');
    expect(res.status).toBe(403);
  });

  it('allows an admin every area', async () => {
    const admin = await seedAdmin('area-admin@example.com');
    asUser(admin);

    for (const area of ['staff', 'faq', 'merch', 'campinfo']) {
      const res = await call('GET', `/api/admin/content/${area}`);
      expect(res.status).toBe(200);
    }
  });

  it('rejects an unknown area with 404, not 500', async () => {
    const admin = await seedAdmin('unknown-area-admin@example.com');
    asUser(admin);

    const getRes = await call('GET', '/api/admin/content/nonsense');
    expect(getRes.status).toBe(404);

    const putRes = await call('PUT', '/api/admin/content/nonsense', {});
    expect(putRes.status).toBe(404);

    const publishRes = await call('POST', '/api/admin/content/nonsense/publish');
    expect(publishRes.status).toBe(404);
  });
});

describe('public content route', () => {
  it('serves published content without authentication', async () => {
    const admin = await seedAdmin('public-serve-admin@example.com');
    asUser(admin);
    await call('PUT', '/api/admin/content/merch', MERCH_PAYLOAD);
    await call('POST', '/api/admin/content/merch/publish');

    // No asUser stub means no JWT mock is active for this call — but the
    // public route must not even attempt auth. Restore mocks entirely to
    // be certain no authentication mechanism is engaged.
    vi.restoreAllMocks();

    const res = await call('GET', '/api/content/merch');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].id).toBe('hoodie');
  });

  it('does NOT serve draft content publicly', async () => {
    const admin = await seedAdmin('draft-hidden-admin@example.com');
    asUser(admin);
    await call('PUT', '/api/admin/content/merch', MERCH_PAYLOAD);
    // Deliberately no publish call.

    vi.restoreAllMocks();

    const res = await call('GET', '/api/content/merch');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(0);
  });

  it('rejects an unknown area with 404, not 500', async () => {
    const res = await call('GET', '/api/content/nonsense');
    expect(res.status).toBe(404);
  });
});

describe('content API round trip', () => {
  it('saves a draft, which does not appear publicly until published', async () => {
    const admin = await seedAdmin('roundtrip-admin@example.com');
    asUser(admin);

    const putRes = await call('PUT', '/api/admin/content/staff', STAFF_PAYLOAD);
    expect(putRes.status).toBe(200);

    const publicRes = await call('GET', '/api/content/staff');
    expect(publicRes.status).toBe(200);
    const publicBody = await publicRes.json();
    expect(publicBody.groups).toHaveLength(0);

    const adminRes = await call('GET', '/api/admin/content/staff');
    expect(adminRes.status).toBe(200);
    const adminBody = await adminRes.json();
    expect(adminBody.draft.groups[0].group).toBe('Directors');
    expect(adminBody.published.groups).toHaveLength(0);
  });

  it('publishes, after which the public route returns the new content', async () => {
    const admin = await seedAdmin('publish-admin@example.com');
    asUser(admin);

    await call('PUT', '/api/admin/content/staff', STAFF_PAYLOAD);
    const publishRes = await call('POST', '/api/admin/content/staff/publish');
    expect(publishRes.status).toBe(200);

    const publicRes = await call('GET', '/api/content/staff');
    const publicBody = await publicRes.json();
    expect(publicBody.groups[0].group).toBe('Directors');
  });

  it('writes an audit row naming the area on publish', async () => {
    const admin = await seedAdmin('audit-publish-admin@example.com');
    asUser(admin);

    await call('PUT', '/api/admin/content/campinfo', { fields: {} });
    await call('POST', '/api/admin/content/campinfo/publish');

    const row = await env.DB.prepare(
      'SELECT * FROM audit_log WHERE action = ? AND detail = ?',
    ).bind('content.publish', 'campinfo').first();
    expect(row).not.toBeNull();
    expect(row.actor_email).toBe(admin);
  });
});
