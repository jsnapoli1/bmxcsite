import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';
import { AuthError } from '../../worker/auth/jwt.js';
import { resetShopSession } from '../../worker/shop/client.js';

function asUser(email) {
  vi.spyOn(jwt, 'verifyAccessJwt').mockResolvedValue(email);
}

function asStranger() {
  vi.spyOn(jwt, 'verifyAccessJwt').mockRejectedValue(new AuthError('Missing Access token'));
}

async function seed(email, columns = {}) {
  const cols = Object.keys(columns);
  await env.DB.prepare(
    `INSERT INTO users (email${cols.length ? `, ${cols.join(', ')}` : ''})
     VALUES (?${cols.map(() => ', ?').join('')})`,
  ).bind(email, ...cols.map((c) => columns[c])).run();
  return email;
}

async function call(method, path, body) {
  return app.fetch(
    new Request(`https://bmxc.camp${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }),
    { ...env, SHOP_ORIGIN: 'https://shop.example', SHOP_ADMIN_PASSWORD: 'hunter2' },
  );
}

/** Stand in for the OpenShop worker, recording what it was sent. */
function stubShop({ status = 200, body = '[]', onRequest } = {}) {
  const calls = [];
  vi.stubGlobal('fetch', async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, method: init?.method ?? 'GET', headers: init?.headers, body: init?.body });
    onRequest?.({ url, init });

    if (url.endsWith('/api/admin/login')) {
      return new Response(JSON.stringify({ token: 'session-abc' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(body, {
      status, headers: { 'content-type': 'application/json' },
    });
  });
  return calls;
}

beforeEach(() => { resetShopSession(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('shop proxy authorisation', () => {
  it('denies a caller with no Access token', async () => {
    stubShop();
    asStranger();
    expect((await call('GET', '/api/admin/shop/products')).status).toBe(403);
  });

  it('denies an editor without the merch permission', async () => {
    stubShop();
    await seed('blogger@example.com', { can_blog: 1 });
    asUser('blogger@example.com');
    expect((await call('GET', '/api/admin/shop/products')).status).toBe(403);
  });

  it('denies an unregistered but verified email', async () => {
    stubShop();
    asUser('stranger@example.com');
    expect((await call('GET', '/api/admin/shop/products')).status).toBe(403);
  });

  it('allows a merch editor', async () => {
    stubShop({ body: '[{"id":"tee"}]' });
    await seed('merch@example.com', { can_merch: 1 });
    asUser('merch@example.com');

    const res = await call('GET', '/api/admin/shop/products');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 'tee' }]);
  });

  it('allows an admin, who passes every area', async () => {
    stubShop();
    await seed('admin@example.com', { is_admin: 1 });
    asUser('admin@example.com');
    expect((await call('GET', '/api/admin/shop/products')).status).toBe(200);
  });

  it('never forwards an unauthorised request upstream', async () => {
    // The check must happen before the proxy, not after — otherwise a denied
    // caller still causes a write.
    const calls = stubShop();
    await seed('nobody@example.com', { can_blog: 1 });
    asUser('nobody@example.com');

    await call('DELETE', '/api/admin/shop/products/tee');
    expect(calls).toHaveLength(0);
  });
});

describe('shop proxy surface', () => {
  beforeEach(async () => {
    await seed('m@example.com', { can_merch: 1 });
    asUser('m@example.com');
  });

  it('refuses endpoints outside the allowlist', async () => {
    const calls = stubShop();
    // OpenShop exposes these; the merch permission does not cover them.
    for (const path of ['/settings', '/media', '/ai/generate', '/agent', '/storage']) {
      const res = await call('GET', `/api/admin/shop${path}`);
      expect(res.status, path).toBe(404);
    }
    expect(calls, 'nothing should have been forwarded').toHaveLength(0);
  });

  it('refuses a method the allowlist does not carry for a path', async () => {
    const calls = stubShop();
    // Analytics is readable, not writable.
    expect((await call('DELETE', '/api/admin/shop/analytics')).status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it('cannot be walked out of the admin prefix', async () => {
    const calls = stubShop();
    const res = await call('GET', '/api/admin/shop/../public/products');
    expect(res.status).not.toBe(200);
    expect(calls).toHaveLength(0);
  });
});

describe('shop proxy behaviour', () => {
  beforeEach(async () => {
    await seed('m@example.com', { can_merch: 1 });
    asUser('m@example.com');
  });

  it('sends the session token, and never the password', async () => {
    const calls = stubShop();
    await call('GET', '/api/admin/shop/products');

    const proxied = calls.find((c) => c.url.includes('/api/admin/products'));
    expect(proxied.headers['X-Admin-Token']).toBe('session-abc');
    for (const call_ of calls) {
      expect(JSON.stringify(call_.headers ?? {})).not.toContain('hunter2');
    }
  });

  it('logs in once and reuses the token across requests', async () => {
    // OpenShop rate-limits login at 5 per 15 minutes per IP; a login per
    // request would lock the panel out under normal use.
    const calls = stubShop();
    await call('GET', '/api/admin/shop/products');
    await call('GET', '/api/admin/shop/products');
    await call('GET', '/api/admin/shop/collections');

    const logins = calls.filter((c) => c.url.endsWith('/api/admin/login'));
    expect(logins).toHaveLength(1);
  });

  it('retries once with a fresh token when upstream rejects the cached one', async () => {
    let seenToken = 0;
    const calls = [];
    vi.stubGlobal('fetch', async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      calls.push({ url });
      if (url.endsWith('/api/admin/login')) {
        return new Response(JSON.stringify({ token: `t${++seenToken}` }), { status: 200 });
      }
      // First proxied call rejects the token, second succeeds.
      const isFirst = calls.filter((c) => c.url.includes('/api/admin/products')).length === 1;
      return new Response(isFirst ? '{"error":"nope"}' : '[]', { status: isFirst ? 401 : 200 });
    });

    const res = await call('GET', '/api/admin/shop/products');
    expect(res.status).toBe(200);
    expect(calls.filter((c) => c.url.endsWith('/api/admin/login'))).toHaveLength(2);
  });

  it('records a write in the audit log, attributed to the person', async () => {
    stubShop({ status: 201, body: '{"id":"new"}' });
    await call('POST', '/api/admin/shop/products', { name: 'Hoodie' });

    const row = await env.DB.prepare(
      `SELECT actor_email, detail FROM audit_log
        WHERE action = 'shop.write' ORDER BY id DESC LIMIT 1`,
    ).first();
    expect(row?.actor_email).toBe('m@example.com');
    expect(row?.detail).toContain('POST /products');
  });

  it('does not record a row for a read', async () => {
    stubShop();
    const before = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM audit_log WHERE action = 'shop.write'`,
    ).first();

    await call('GET', '/api/admin/shop/products');

    const after = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM audit_log WHERE action = 'shop.write'`,
    ).first();
    expect(after.n).toBe(before.n);
  });

  it('does not audit a write the store rejected', async () => {
    stubShop({ status: 422, body: '{"error":"Name is required"}' });
    const before = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM audit_log WHERE action = 'shop.write'`,
    ).first();

    const res = await call('POST', '/api/admin/shop/products', {});
    expect(res.status).toBe(422);

    const after = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM audit_log WHERE action = 'shop.write'`,
    ).first();
    expect(after.n).toBe(before.n);
  });

  it('passes the store’s own error through rather than flattening it', async () => {
    stubShop({ status: 422, body: '{"error":"Name is required"}' });
    const res = await call('POST', '/api/admin/shop/products', {});
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Name is required' });
  });

  it('answers 503 when the store is not configured', async () => {
    await seed('m2@example.com', { can_merch: 1 });
    asUser('m2@example.com');
    const res = await app.fetch(
      new Request('https://bmxc.camp/api/admin/shop/products'),
      env, // no SHOP_ORIGIN / SHOP_ADMIN_PASSWORD
    );
    expect(res.status).toBe(503);
  });
});
