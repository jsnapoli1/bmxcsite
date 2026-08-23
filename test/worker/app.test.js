import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';

describe('worker app', () => {
  it('serves the static site at /', async () => {
    const res = await app.fetch(new Request('https://bmxc.camp/'), env);
    expect(res.status).toBe(200);
  });

  it('returns 404 JSON for an unknown API route', async () => {
    const res = await app.fetch(
      new Request('https://bmxc.camp/api/nope'),
      env,
    );
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  describe('admin SPA fallback', () => {
    const paths = ['/admin', '/admin/', '/admin/anything', '/admin/deep/nested/path'];

    for (const path of paths) {
      it(`serves admin-root at ${path}`, async () => {
        const res = await app.fetch(
          new Request(`https://bmxc.camp${path}`),
          env,
        );
        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toContain('admin-root');
      });
    }
  });

  it('onError catches an unexpected D1 fault and answers 500 without leaking internals', async () => {
    vi.spyOn(jwt, 'verifyAccessJwt').mockResolvedValue('faulty-admin@example.com');
    await env.DB.prepare(
      'INSERT INTO users (email, is_admin) VALUES (?, 1)',
    ).bind('faulty-admin@example.com').run();

    const dbError = new Error('sensitive detail: D1_ERROR connection string xyz');
    const prepareSpy = vi.spyOn(env.DB, 'prepare').mockImplementation(() => {
      throw dbError;
    });

    try {
      const res = await app.fetch(
        new Request('https://bmxc.camp/api/admin/users'),
        env,
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'Something went wrong' });
      const raw = JSON.stringify(body);
      expect(raw).not.toContain('sensitive detail');
      expect(raw).not.toContain('D1_ERROR');
    } finally {
      prepareSpy.mockRestore();
      vi.restoreAllMocks();
    }
  });
});
