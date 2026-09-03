import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';
import * as client from '../../worker/email/routing-client.js';

function asUser(email) {
  vi.spyOn(jwt, 'verifyAccessJwt').mockResolvedValue(email);
}

async function seedUser(email, { campinfo = false } = {}) {
  await env.DB.prepare(
    'INSERT INTO users (email, can_campinfo) VALUES (?, ?)',
  ).bind(email, campinfo ? 1 : 0).run();
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

afterEach(() => vi.restoreAllMocks());

describe('staff addresses', () => {
  it('lists addresses for someone holding campinfo', async () => {
    asUser(await seedUser('c1@example.com', { campinfo: true }));
    vi.spyOn(client, 'listRules').mockResolvedValue([
      { id: 'r1', name: 'ken', address: 'ken@bmxc.camp', destination: 'k@g.com', enabled: true },
    ]);

    const res = await call('GET', '/api/admin/email/addresses');
    expect(res.status).toBe(200);
    expect((await res.json()).addresses).toHaveLength(1);
  });

  it('refuses someone without campinfo', async () => {
    asUser(await seedUser('c2@example.com', { campinfo: false }));
    const res = await call('GET', '/api/admin/email/addresses');
    expect(res.status).toBe(403);
  });

  it('turns a client validation failure into a 400', async () => {
    asUser(await seedUser('c3@example.com', { campinfo: true }));
    const res = await call('POST', '/api/admin/email/addresses', {
      address: 'ken@example.com', destination: 'k@g.com',
    });
    expect(res.status).toBe(400);
  });

  it('audits a created address', async () => {
    asUser(await seedUser('c5@example.com', { campinfo: true }));
    vi.spyOn(client, 'createRule').mockResolvedValue({
      id: 'r2', name: 'new', address: 'new@bmxc.camp', destination: 'n@g.com', enabled: true,
    });

    await call('POST', '/api/admin/email/addresses', {
      address: 'new@bmxc.camp', destination: 'n@g.com',
    });

    const row = await env.DB.prepare(
      "SELECT * FROM audit_log WHERE action = 'email.address.create' ORDER BY id DESC",
    ).first();
    expect(row.actor_email).toBe('c5@example.com');
    expect(row.detail).toBe('new@bmxc.camp');
  });
});

describe('the public subscribe flow', () => {
  it('accepts a subscription with no sign-in', async () => {
    const res = await call('POST', '/api/subscribe', { email: 'p@example.com' });
    expect(res.status).toBe(200);
  });

  it('answers the same for a repeat address', async () => {
    // Must not become a way to test who is on the list.
    const first = await call('POST', '/api/subscribe', { email: 'same@example.com' });
    const firstBody = await first.text();
    const second = await call('POST', '/api/subscribe', { email: 'same@example.com' });
    expect(second.status).toBe(first.status);
    expect(await second.text()).toBe(firstBody);
  });

  it('confirms from the emailed link', async () => {
    await call('POST', '/api/subscribe', { email: 'conf@example.com' });
    const row = await env.DB.prepare(
      "SELECT token FROM subscribers WHERE email = 'conf@example.com'",
    ).first();

    const res = await call('GET', `/api/subscribe/confirm?token=${row.token}`);
    expect(res.status).toBe(200);

    const after = await env.DB.prepare(
      "SELECT status FROM subscribers WHERE email = 'conf@example.com'",
    ).first();
    expect(after.status).toBe('confirmed');
  });

  it('unsubscribes on one click with no sign-in', async () => {
    await call('POST', '/api/subscribe', { email: 'un@example.com' });
    const row = await env.DB.prepare(
      "SELECT token FROM subscribers WHERE email = 'un@example.com'",
    ).first();

    const res = await call('GET', `/api/unsubscribe?token=${row.token}`);
    expect(res.status).toBe(200);

    const after = await env.DB.prepare(
      "SELECT status FROM subscribers WHERE email = 'un@example.com'",
    ).first();
    expect(after.status).toBe('unsubscribed');
  });

  it('answers a bad token without saying whether it ever existed', async () => {
    const res = await call('GET', '/api/unsubscribe?token=bogus');
    expect(res.status).toBe(200);
  });

  it('does not expose the subscriber list publicly', async () => {
    const res = await call('GET', '/api/admin/email/subscribers');
    expect(res.status).toBe(403);
  });

  it('never returns a token to a caller', async () => {
    // The token is the unsubscribe credential. Handing it back from the
    // public endpoint would let anyone unsubscribe anyone.
    const res = await call('POST', '/api/subscribe', { email: 'leak@example.com' });
    const body = await res.text();
    const row = await env.DB.prepare(
      "SELECT token FROM subscribers WHERE email = 'leak@example.com'",
    ).first();
    expect(body).not.toContain(row.token);
  });
});

describe('mounting the public routes did not shadow anything', () => {
  it('still serves public content', async () => {
    // subscribeRoutes mounts at /api, which sits above /api/content. Hono
    // matches in order, so this pins that the broader mount did not
    // swallow the narrower ones registered after it.
    const res = await call('GET', '/api/content/staff');
    expect(res.status).not.toBe(404);
  });

  it('still serves the public vedit document', async () => {
    const res = await call('GET', '/api/vedit?page=/');
    expect(res.status).not.toBe(404);
  });
});

describe('subscriber export', () => {
  it('serves CSV to someone holding campinfo', async () => {
    asUser(await seedUser('c4@example.com', { campinfo: true }));
    const res = await call('GET', '/api/admin/email/subscribers.csv');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
  });

  it('does not put the token in the export', async () => {
    asUser(await seedUser('c6@example.com', { campinfo: true }));
    await call('POST', '/api/subscribe', { email: 'csv@example.com' });
    const row = await env.DB.prepare(
      "SELECT token FROM subscribers WHERE email = 'csv@example.com'",
    ).first();
    await call('GET', `/api/subscribe/confirm?token=${row.token}`);

    const res = await call('GET', '/api/admin/email/subscribers.csv');
    expect(await res.text()).not.toContain(row.token);
  });
});
