import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';
import { AuthError } from '../../worker/auth/jwt.js';
import { createVeditHandler } from 'vedit/server';
import { d1Store, UnknownStageError } from '../../worker/vedit/store.js';

function asUser(email) {
  vi.spyOn(jwt, 'verifyAccessJwt').mockResolvedValue(email);
}

/**
 * A caller with no Access token at all — the public site, or anyone off the
 * internet. Rejects with the real AuthError: requireAuth branches on
 * `instanceof`, so a look-alike carrying only the right `name` would fall
 * through as an unhandled 500 and quietly stop testing the 403 path.
 */
function asStranger() {
  vi.spyOn(jwt, 'verifyAccessJwt')
    .mockRejectedValue(new AuthError('Missing Access token'));
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
    env,
  );
}

function doc(key, nodes = {}) {
  return {
    version: 1,
    key,
    updatedAt: new Date(0).toISOString(),
    nodes,
    inserted: [],
    tokens: [],
  };
}

describe('vedit API authorisation', () => {
  it('denies an editor without the design permission', async () => {
    await seed('blogger@example.com', { can_blog: 1 });
    asUser('blogger@example.com');

    const res = await call('GET', '/api/admin/vedit?key=/');
    expect(res.status).toBe(403);
  });

  it('denies campinfo, which must not imply design', async () => {
    // The whole reason `design` is its own column: vedit reaches every page,
    // so granting it through campinfo would silently widen that editor's
    // reach across merch and blog too.
    await seed('campinfo@example.com', { can_campinfo: 1 });
    asUser('campinfo@example.com');

    expect((await call('GET', '/api/admin/vedit?key=/')).status).toBe(403);
  });

  it('denies an unregistered but verified email', async () => {
    asUser('stranger@example.com');
    expect((await call('GET', '/api/admin/vedit?key=/')).status).toBe(403);
  });

  it('denies a request carrying no Access token', async () => {
    asStranger();
    expect((await call('GET', '/api/admin/vedit?key=/')).status).toBe(403);
  });

  it('allows a design-permission holder', async () => {
    await seed('designer@example.com', { can_design: 1 });
    asUser('designer@example.com');

    const res = await call('GET', '/api/admin/vedit?key=/');
    expect(res.status).toBe(200);
  });

  it('allows an admin, who passes every area', async () => {
    await seed('admin@example.com', { is_admin: 1 });
    asUser('admin@example.com');

    expect((await call('GET', '/api/admin/vedit?key=/')).status).toBe(200);
  });
});

describe('published document endpoint', () => {
  it('is readable with no Access token at all', async () => {
    // The public site has no token. If this ever requires one, every
    // visitor silently loses published overrides.
    asStranger();
    const res = await call('GET', '/api/vedit?key=/');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ document: null });
  });

  it('rejects a request with no key', async () => {
    asStranger();
    expect((await call('GET', '/api/vedit')).status).toBe(400);
  });

  it('serves the published document but never the draft', async () => {
    const store = d1Store(env.DB, 'designer@example.com');
    await store.write(doc('/camp', { a: { text: 'draft text' } }), 'draft');

    asStranger();
    const beforePublish = await call('GET', '/api/vedit?key=/camp');
    expect((await beforePublish.json()).document).toBeNull();

    await store.write(doc('/camp', { a: { text: 'live text' } }), 'published');

    const afterPublish = await call('GET', '/api/vedit?key=/camp');
    expect((await afterPublish.json()).document.nodes.a.text).toBe('live text');
  });

  it('cannot be coaxed into serving a draft via the query string', async () => {
    const store = d1Store(env.DB, 'designer@example.com');
    await store.write(doc('/faq', { a: { text: 'secret draft' } }), 'draft');

    asStranger();
    const res = await call('GET', '/api/vedit?key=/faq&stage=draft');
    expect((await res.json()).document).toBeNull();
  });
});

describe('vedit store', () => {
  it('round-trips a document', async () => {
    const store = d1Store(env.DB, 'designer@example.com');
    await store.write(doc('/merch', { t: { text: 'Hello' } }), 'published');

    const read = await store.read('/merch', 'published');
    expect(read.nodes.t.text).toBe('Hello');
  });

  it('keeps draft and published independent', async () => {
    const store = d1Store(env.DB, 'designer@example.com');
    await store.write(doc('/staff', { t: { text: 'published' } }), 'published');
    await store.write(doc('/staff', { t: { text: 'draft' } }), 'draft');

    expect((await store.read('/staff', 'published')).nodes.t.text)
      .toBe('published');
    expect((await store.read('/staff', 'draft')).nodes.t.text).toBe('draft');
  });

  it('overwrites rather than duplicating on repeated writes', async () => {
    const store = d1Store(env.DB, 'designer@example.com');
    await store.write(doc('/contact', { t: { text: 'one' } }), 'draft');
    await store.write(doc('/contact', { t: { text: 'two' } }), 'draft');

    const { results } = await env.DB.prepare(
      'SELECT doc FROM vedit_documents WHERE key = ? AND stage = ?',
    ).bind('/contact', 'draft').all();

    expect(results).toHaveLength(1);
    expect((await store.read('/contact', 'draft')).nodes.t.text).toBe('two');
  });

  it('rejects an unknown stage instead of failing the CHECK constraint', async () => {
    const store = d1Store(env.DB, 'designer@example.com');
    await expect(store.read('/', 'live')).rejects.toThrow(UnknownStageError);
    await expect(store.write(doc('/'), 'live')).rejects.toThrow(UnknownStageError);
  });

  it('records a version on publish, but not on a draft save', async () => {
    const store = d1Store(env.DB, 'designer@example.com');
    await store.write(doc('/videos', { t: { text: 'a' } }), 'draft');
    expect(await store.listVersions('/videos')).toHaveLength(0);

    await store.write(doc('/videos', { t: { text: 'b' } }), 'published');
    await store.write(doc('/videos', { t: { text: 'c' } }), 'published');

    const versions = await store.listVersions('/videos');
    expect(versions).toHaveLength(2);
    expect(versions[0].label).toBe('designer@example.com');
  });

  it('reads back a specific version', async () => {
    const store = d1Store(env.DB, 'designer@example.com');
    await store.write(doc('/playlists', { t: { text: 'first' } }), 'published');
    await store.write(doc('/playlists', { t: { text: 'second' } }), 'published');

    const [, older] = await store.listVersions('/playlists');
    const restored = await store.readVersion('/playlists', older.id);
    expect(restored.nodes.t.text).toBe('first');
  });

  it('answers null for a version belonging to another page', async () => {
    // Guards against a key-less lookup letting one page's history leak into
    // another's History panel.
    const store = d1Store(env.DB, 'designer@example.com');
    await store.write(doc('/blog', { t: { text: 'blog' } }), 'published');
    const [version] = await store.listVersions('/blog');

    expect(await store.readVersion('/registration', version.id)).toBeNull();
  });

  it('answers null for a non-numeric version id', async () => {
    const store = d1Store(env.DB, 'designer@example.com');
    expect(await store.readVersion('/', 'not-a-number')).toBeNull();
  });

  it('treats an unparseable document as absent rather than throwing', async () => {
    // Only reachable through corruption or a direct SQL edit. The page must
    // still render — degrading to the authored design, never a 500.
    await env.DB.prepare(
      `INSERT INTO vedit_documents (key, stage, doc) VALUES (?, ?, ?)`,
    ).bind('/broken', 'published', '{not json').run();

    const store = d1Store(env.DB);
    expect(await store.read('/broken', 'published')).toBeNull();
  });

  it('lists edited pages with the newest timestamp per key', async () => {
    const store = d1Store(env.DB, 'designer@example.com');
    await store.write(doc('/list-a'), 'draft');
    await store.write(doc('/list-b'), 'published');

    const keys = (await store.list()).map((entry) => entry.key);
    expect(keys).toContain('/list-a');
    expect(keys).toContain('/list-b');

    const entry = (await store.list()).find((e) => e.key === '/list-a');
    expect(() => new Date(entry.updatedAt).toISOString()).not.toThrow();
  });
});

describe('vedit audit trail', () => {
  it('records a write, attributed to the designer', async () => {
    await seed('auditor@example.com', { can_design: 1 });
    asUser('auditor@example.com');

    await call('PUT', '/api/admin/vedit', doc('/', { t: { text: 'x' } }));

    const row = await env.DB.prepare(
      `SELECT actor_email, action FROM audit_log
        WHERE action = 'vedit.write' ORDER BY id DESC LIMIT 1`,
    ).first();

    expect(row?.actor_email).toBe('auditor@example.com');
  });

  it('does not record a row for a read', async () => {
    await seed('reader@example.com', { can_design: 1 });
    asUser('reader@example.com');

    const before = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM audit_log WHERE action = 'vedit.write'`,
    ).first();

    await call('GET', '/api/admin/vedit?key=/');

    const after = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM audit_log WHERE action = 'vedit.write'`,
    ).first();

    expect(after.n).toBe(before.n);
  });
});

describe('draft -> publish, end to end', () => {
  // A key of its own, not '/': other tests in this file write drafts to the
  // root key, and D1 state persists across tests in a file. Sharing it made
  // this test pass alone and fail in suite — the failure mode that hides a
  // real regression behind "it works on my machine".
  const KEY = '/e2e-draft-publish';

  it('keeps a draft from visitors until it is published', async () => {
    await env.DB.prepare('INSERT INTO users (email, can_design) VALUES (?, 1)')
      .bind('d@example.com').run();
    asUser('d@example.com');

    // 1. Designer saves a draft. A plain PUT is a draft save; publishing is
    // signalled by `?action=publish` — that is vedit's wire protocol, not a
    // `stage` parameter, which only the GET side understands.
    const put = await call('PUT', `/api/admin/vedit?key=${KEY}`,
      doc(KEY, { 'home.hero.tagline': { text: 'DRAFT ONLY' } }));
    expect([200, 201, 204]).toContain(put.status);

    // 2. A visitor must not see it. This is the assertion the whole staged
    // setup exists for: an unfinished redesign must never reach the parents
    // and athletes reading the site.
    const visitorDuringDraft = await call('GET', `/api/vedit?key=${KEY}`);
    expect((await visitorDuringDraft.json()).document).toBeNull();

    // 3. Designer publishes.
    const pub = await call('PUT', `/api/admin/vedit?key=${KEY}&action=publish`,
      doc(KEY, { 'home.hero.tagline': { text: 'PUBLISHED COPY' } }));
    expect([200, 201, 204]).toContain(pub.status);

    // 4. Now the visitor sees exactly the published text.
    const visitorAfter = await call('GET', `/api/vedit?key=${KEY}`);
    const body = await visitorAfter.json();
    expect(body.document.nodes['home.hero.tagline'].text).toBe('PUBLISHED COPY');
  });
});

describe('handler construction', () => {
  it('refuses to build a handler with no authorize callback', () => {
    // vedit 0.4.0 made `authorize` required precisely because leaving it off
    // made the open configuration the default one. This test is here so a
    // future refactor that drops the callback from worker/routes/vedit.js
    // fails loudly rather than quietly serving an endpoint any request can
    // write to.
    const store = d1Store(env.DB);
    expect(() => createVeditHandler({ store })).toThrow(TypeError);
  });

  it('builds when authorize is supplied', () => {
    const store = d1Store(env.DB);
    expect(() => createVeditHandler({ store, authorize: () => true }))
      .not.toThrow();
  });
});

describe('what /api/admin/me tells the client', () => {
  // The editor decides whether to show its entry point from this response.
  // It got that wrong once: it read `permissions.design` alone, while the
  // server's hasPermission() short-circuits on isAdmin before looking at
  // any column. An admin with can_design = 0 could write and was shown no
  // way to start. These pin the two facts the client needs.
  it('reports isAdmin, which alone is enough to write', async () => {
    await seed('admin-only@example.com', { is_admin: 1 });
    asUser('admin-only@example.com');

    const body = await (await call('GET', '/api/admin/me')).json();

    // Exactly the shape that misled the client: admin true, column false.
    expect(body.isAdmin).toBe(true);
    expect(body.permissions.design).toBe(false);

    // And the server does let them write, which is why the button must show.
    expect((await call('GET', '/api/admin/vedit?key=/')).status).toBe(200);
  });

  it('reports the design permission for a non-admin who holds it', async () => {
    await seed('designer-only@example.com', { can_design: 1 });
    asUser('designer-only@example.com');

    const body = await (await call('GET', '/api/admin/me')).json();
    expect(body.isAdmin).toBe(false);
    expect(body.permissions.design).toBe(true);
  });

  it('reports neither for someone who may not edit', async () => {
    await seed('blogger-only@example.com', { can_blog: 1 });
    asUser('blogger-only@example.com');

    const body = await (await call('GET', '/api/admin/me')).json();
    expect(body.isAdmin).toBe(false);
    expect(body.permissions.design).toBe(false);
    expect((await call('GET', '/api/admin/vedit?key=/')).status).toBe(403);
  });
});
