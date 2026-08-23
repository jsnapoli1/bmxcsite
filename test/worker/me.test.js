import { describe, it, expect, beforeAll, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';
import { requireAuth, requireArea } from '../../worker/auth/middleware.js';

// The JWT path has its own dedicated tests; here we stub verification so
// these tests exercise authorisation rather than re-testing crypto.
function asUser(email) {
  vi.spyOn(jwt, 'verifyAccessJwt').mockResolvedValue(email);
}

function asAnonymous() {
  vi.spyOn(jwt, 'verifyAccessJwt').mockRejectedValue(
    new jwt.AuthError('Missing Access token'),
  );
}

async function get(path) {
  return app.fetch(new Request(`https://bmxc.camp${path}`), env);
}

describe('GET /api/admin/me', () => {
  it('rejects an unauthenticated request', async () => {
    asAnonymous();
    const res = await get('/api/admin/me');
    expect(res.status).toBe(403);
  });

  it('reports registered:false for a verified but ungranted email', async () => {
    asUser('stranger@example.com');
    const res = await get('/api/admin/me');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.registered).toBe(false);
    expect(body.isAdmin).toBe(false);
    expect(body.permissions.blog).toBe(false);
  });

  it('reports the permissions of a known user', async () => {
    await env.DB.prepare(
      'INSERT INTO users (email, name, can_blog) VALUES (?, ?, 1)',
    ).bind('writer@example.com', 'Writer').run();

    asUser('writer@example.com');
    const res = await get('/api/admin/me');
    const body = await res.json();
    expect(body.registered).toBe(true);
    expect(body.name).toBe('Writer');
    expect(body.permissions.blog).toBe(true);
    expect(body.permissions.merch).toBe(false);
  });
});

describe('requireArea', () => {
  // A throwaway app: requireArea guards Phase 2 routes that do not exist yet,
  // and an untested guard is a guard that protects nothing.
  const guarded = new Hono();
  guarded.use('/api/admin/*', requireAuth);
  guarded.get('/api/admin/blog', requireArea('blog'), (c) =>
    c.json({ ok: true }));

  const call = () =>
    guarded.fetch(new Request('https://bmxc.camp/api/admin/blog'), env);

  it('denies a user without the area', async () => {
    await env.DB.prepare(
      'INSERT INTO users (email, can_merch) VALUES (?, 1)',
    ).bind('merchonly@example.com').run();
    asUser('merchonly@example.com');
    expect((await call()).status).toBe(403);
  });

  it('denies a verified but unregistered email', async () => {
    asUser('nobody@example.com');
    expect((await call()).status).toBe(403);
  });

  it('allows a user with the area', async () => {
    await env.DB.prepare(
      'INSERT INTO users (email, can_blog) VALUES (?, 1)',
    ).bind('blogonly@example.com').run();
    asUser('blogonly@example.com');
    expect((await call()).status).toBe(200);
  });

  it('allows an admin', async () => {
    await env.DB.prepare(
      'INSERT INTO users (email, is_admin) VALUES (?, 1)',
    ).bind('admin2@example.com').run();
    asUser('admin2@example.com');
    expect((await call()).status).toBe(200);
  });
});

describe('requireAuth 403 responses are indistinguishable', () => {
  // AuthError carries four distinct causes (unconfigured, missing token,
  // invalid token, no email claim). A caller must not be able to tell them
  // apart from the response — that would leak configuration state. Every
  // rejection path must produce the identical status and body.
  async function bodyAndStatus() {
    const res = await get('/api/admin/me');
    return { status: res.status, body: await res.json() };
  }

  it('a missing token produces the generic 403 body', async () => {
    vi.spyOn(jwt, 'verifyAccessJwt').mockRejectedValue(
      new jwt.AuthError('Missing Access token'),
    );
    const result = await bodyAndStatus();
    expect(result).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });

  it('a malformed/invalid token produces the identical 403 body', async () => {
    vi.spyOn(jwt, 'verifyAccessJwt').mockRejectedValue(
      new jwt.AuthError('Invalid Access token'),
    );
    const result = await bodyAndStatus();
    expect(result).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });

  it('an unconfigured environment produces the identical 403 body', async () => {
    vi.spyOn(jwt, 'verifyAccessJwt').mockRejectedValue(
      new jwt.AuthError('Access is not configured'),
    );
    const result = await bodyAndStatus();
    expect(result).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });

  it('a token with no email claim produces the identical 403 body', async () => {
    vi.spyOn(jwt, 'verifyAccessJwt').mockRejectedValue(
      new jwt.AuthError('Access token has no email claim'),
    );
    const result = await bodyAndStatus();
    expect(result).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });

  it('produces byte-identical responses across every AuthError cause', async () => {
    const causes = [
      'Access is not configured',
      'Missing Access token',
      'Invalid Access token',
      'Access token has no email claim',
    ];

    const results = [];
    for (const message of causes) {
      vi.spyOn(jwt, 'verifyAccessJwt').mockRejectedValue(
        new jwt.AuthError(message),
      );
      const res = await get('/api/admin/me');
      results.push({
        status: res.status,
        text: await res.text(),
      });
    }

    for (const result of results) {
      expect(result).toEqual(results[0]);
    }
    expect(results[0]).toEqual({
      status: 403,
      text: JSON.stringify({ error: 'Forbidden' }),
    });
  });
});
