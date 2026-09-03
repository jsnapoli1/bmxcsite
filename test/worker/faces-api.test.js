import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';

function asUser(email) {
  vi.spyOn(jwt, 'verifyAccessJwt').mockResolvedValue(email);
}

async function seedUser(email, { faces = false, media = false } = {}) {
  await env.DB.prepare(
    'INSERT INTO users (email, can_faces, can_media) VALUES (?, ?, ?)',
  ).bind(email, faces ? 1 : 0, media ? 1 : 0).run();
  return email;
}

async function call(method, path, body) {
  return app.fetch(
    new Request(`https://bmxc.camp${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }),
    { ...env, FACE_ORIGIN: 'https://faces.example.com', FACE_TOKEN: 'secret' },
  );
}

async function callWithoutOrigin(method, path) {
  return app.fetch(
    new Request(`https://bmxc.camp${path}`, { method }),
    { ...env, FACE_ORIGIN: undefined },
  );
}

afterEach(() => vi.restoreAllMocks());

describe('the faces permission', () => {
  it('refuses someone without it', async () => {
    asUser(await seedUser('f1@example.com', { faces: false }));
    const res = await call('GET', '/api/admin/faces/campers');
    expect(res.status).toBe(403);
  });

  it('refuses someone who only has media', async () => {
    // faces is its own area precisely so `media` does not carry it.
    asUser(await seedUser('f2@example.com', { faces: false, media: true }));
    const res = await call('GET', '/api/admin/faces/campers');
    expect(res.status).toBe(403);
  });

  it('allows someone holding it', async () => {
    asUser(await seedUser('f3@example.com', { faces: true }));
    const res = await call('GET', '/api/admin/faces/campers');
    expect(res.status).toBe(200);
  });
});

describe('availability', () => {
  it('reports the service unavailable when FACE_ORIGIN is unset', async () => {
    asUser(await seedUser('f4@example.com', { faces: true }));
    const res = await callWithoutOrigin('GET', '/api/admin/faces/identities');
    expect(res.status).toBe(503);
  });

  it('still serves the roster without the service', async () => {
    // The roster is ours; a director can record consent long before
    // anything is deployed.
    asUser(await seedUser('f5@example.com', { faces: true }));
    const res = await callWithoutOrigin('GET', '/api/admin/faces/campers');
    expect(res.status).toBe(200);
  });
});

describe('the proxy allowlist', () => {
  it('forwards an allowed path', async () => {
    asUser(await seedUser('f6@example.com', { faces: true }));
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ identities: [] }), {
        headers: { 'content-type': 'application/json' },
      }),
    );

    const res = await call('GET', '/api/admin/faces/identities');
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalled();
  });

  it('refuses a path that is not on the list', async () => {
    // The service also exposes /config and an agent endpoint. Neither
    // belongs to this permission.
    asUser(await seedUser('f7@example.com', { faces: true }));
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    const res = await call('GET', '/api/admin/faces/config');
    expect(res.status).toBe(404);
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not forward an unenroll for a non-numeric identity', async () => {
    // The pattern pins \d+ so a path segment cannot smuggle anything else
    // into the service's URL.
    asUser(await seedUser('f12@example.com', { faces: true }));
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    const res = await call('POST', '/api/admin/faces/identities/abc/unenroll');
    expect(res.status).toBe(404);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('consent gates ingest', () => {
  it('sends only consenting campers to the service', async () => {
    asUser(await seedUser('f9@example.com', { faces: true }));
    await env.DB.prepare('DELETE FROM campers').run();
    await env.DB.prepare(
      `INSERT INTO campers (bib, name, created_by, consent_at, consent_by)
       VALUES ('601', 'Yes', 'a@b.c', unixepoch(), 'a@b.c')`,
    ).run();
    await env.DB.prepare(
      "INSERT INTO campers (bib, name, created_by) VALUES ('602', 'No', 'a@b.c')",
    ).run();

    let sentBody;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).endsWith('/roster')) sentBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      });
    });

    await call('POST', '/api/admin/faces/ingest');

    expect(sentBody).toHaveProperty('601');
    expect(sentBody).not.toHaveProperty('602');
  });

  it('refuses to ingest when nobody has consented', async () => {
    // Ingesting with an empty roster would enroll nobody, but it would
    // still read every photograph. Refuse and say why.
    asUser(await seedUser('f10@example.com', { faces: true }));
    await env.DB.prepare('DELETE FROM campers').run();

    const res = await call('POST', '/api/admin/faces/ingest');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/consent/i);
  });

  it('does not call the service at all when nobody has consented', async () => {
    asUser(await seedUser('f13@example.com', { faces: true }));
    await env.DB.prepare('DELETE FROM campers').run();
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    await call('POST', '/api/admin/faces/ingest');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('audit', () => {
  it('records a consent change', async () => {
    asUser(await seedUser('f11@example.com', { faces: true }));
    await env.DB.prepare('DELETE FROM campers').run();
    await env.DB.prepare(
      "INSERT INTO campers (bib, name, created_by) VALUES ('701', 'Audited', 'a@b.c')",
    ).run();

    await call('POST', '/api/admin/faces/campers/701/consent');

    const row = await env.DB.prepare(
      "SELECT * FROM audit_log WHERE action = 'faces.consent.record' ORDER BY id DESC",
    ).first();
    expect(row.detail).toBe('701');
    expect(row.actor_email).toBe('f11@example.com');
  });

  it('records a withdrawal', async () => {
    asUser(await seedUser('f14@example.com', { faces: true }));
    await env.DB.prepare('DELETE FROM campers').run();
    await env.DB.prepare(
      `INSERT INTO campers (bib, name, created_by, consent_at, consent_by)
       VALUES ('702', 'Leaving', 'a@b.c', unixepoch(), 'a@b.c')`,
    ).run();

    await call('DELETE', '/api/admin/faces/campers/702/consent');

    const row = await env.DB.prepare(
      "SELECT * FROM audit_log WHERE action = 'faces.consent.withdraw' ORDER BY id DESC",
    ).first();
    expect(row.detail).toBe('702');
  });
});
