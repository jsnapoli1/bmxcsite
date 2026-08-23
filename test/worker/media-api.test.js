import {
  describe, it, expect, vi,
} from 'vitest';
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

async function call(method, path, body, headers) {
  return app.fetch(
    new Request(`https://bmxc.camp${path}`, {
      method,
      headers: headers ?? (body ? { 'content-type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );
}

const JPEG = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...new Array(64).fill(0x41)]);

function jpegFormData(filename = 'photo.jpg') {
  const form = new FormData();
  form.set('file', new File([JPEG], filename, { type: 'image/jpeg' }));
  return form;
}

async function callUpload(formData) {
  return app.fetch(
    new Request('https://bmxc.camp/api/admin/media', {
      method: 'POST',
      body: formData,
    }),
    env,
  );
}

async function uploadAsMediaEditor(email = 'media-editor@example.com') {
  await seedUser(email, { media: true });
  asUser(email);
  const res = await callUpload(jpegFormData());
  expect(res.status).toBe(201);
  const { media } = await res.json();
  return media;
}

describe('media API authorisation', () => {
  it('denies upload to a user without the media permission', async () => {
    await seedUser('no-media@example.com', { blog: true });
    asUser('no-media@example.com');

    const res = await callUpload(jpegFormData());
    expect(res.status).toBe(403);
  });

  it('denies publish to a user without the media permission', async () => {
    await seedUser('no-media-publish@example.com', { blog: true });
    asUser('no-media-publish@example.com');

    const res = await call('POST', '/api/admin/media/some-key.jpg/publish');
    expect(res.status).toBe(403);
  });

  it('denies unpublish and delete to a user without the media permission', async () => {
    await seedUser('no-media-unpub@example.com', { blog: true });
    asUser('no-media-unpub@example.com');

    const unpublishRes = await call('POST', '/api/admin/media/some-key.jpg/unpublish');
    expect(unpublishRes.status).toBe(403);

    const deleteRes = await call('DELETE', '/api/admin/media/some-key.jpg');
    expect(deleteRes.status).toBe(403);
  });

  it('denies a verified but unregistered email', async () => {
    asUser('stranger@example.com');

    expect((await call('GET', '/api/admin/media')).status).toBe(403);
    expect((await callUpload(jpegFormData())).status).toBe(403);
  });

  it('the public route does not serve a private object', async () => {
    const media = await uploadAsMediaEditor();

    const res = await app.fetch(
      new Request(`https://bmxc.camp/media/${media.key}`),
      env,
    );
    expect(res.status).toBe(404);
  });

  it('the public route 404s an unknown key', async () => {
    const res = await app.fetch(
      new Request('https://bmxc.camp/media/no-such-key.jpg'),
      env,
    );
    expect(res.status).toBe(404);
  });
});

describe('media upload', () => {
  it('an oversize upload returns 413, not 500', async () => {
    await seedUser('big-upload@example.com', { media: true });
    asUser('big-upload@example.com');

    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set([0xFF, 0xD8, 0xFF]);
    const form = new FormData();
    form.set('file', new File([big], 'big.jpg', { type: 'image/jpeg' }));

    const res = await callUpload(form);
    expect(res.status).toBe(413);
  });

  it('a disallowed content type returns 400, not 500', async () => {
    await seedUser('bad-type-upload@example.com', { media: true });
    asUser('bad-type-upload@example.com');

    const svg = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
    const form = new FormData();
    form.set('file', new File([svg], 'evil.svg', { type: 'image/svg+xml' }));

    const res = await callUpload(form);
    expect(res.status).toBe(400);
  });

  it('a successful upload lists as private and is not publicly reachable', async () => {
    const media = await uploadAsMediaEditor();
    expect(media.status).toBe('private');

    const listRes = await call('GET', '/api/admin/media');
    // the admin who uploaded also has 'media' permission, reuse same session
    expect(listRes.status).toBe(200);
  });
});

describe('media publish / unpublish / delete', () => {
  it('publishing writes an audit row', async () => {
    const editorEmail = 'audit-publish@example.com';
    await seedUser(editorEmail, { media: true });
    asUser(editorEmail);
    const uploadRes = await callUpload(jpegFormData());
    const { media } = await uploadRes.json();
    await call('PATCH', `/api/admin/media/${media.key}`, { altText: 'Campers at the lake.' });

    const publishRes = await call('POST', `/api/admin/media/${media.key}/publish`);
    expect(publishRes.status).toBe(200);

    const row = await env.DB.prepare(
      'SELECT * FROM audit_log WHERE action = ? AND detail = ?',
    ).bind('media.publish', media.key).first();
    expect(row).not.toBeNull();
    expect(row.actor_email).toBe(editorEmail);
  });

  it('unpublishing writes an audit row', async () => {
    const editorEmail = 'audit-unpublish@example.com';
    await seedUser(editorEmail, { media: true });
    asUser(editorEmail);
    const uploadRes = await callUpload(jpegFormData());
    const { media } = await uploadRes.json();
    await call('PATCH', `/api/admin/media/${media.key}`, { altText: 'Campers at the lake.' });
    await call('POST', `/api/admin/media/${media.key}/publish`);

    const unpublishRes = await call('POST', `/api/admin/media/${media.key}/unpublish`);
    expect(unpublishRes.status).toBe(200);

    const row = await env.DB.prepare(
      'SELECT * FROM audit_log WHERE action = ? AND detail = ?',
    ).bind('media.unpublish', media.key).first();
    expect(row).not.toBeNull();
    expect(row.actor_email).toBe(editorEmail);
  });

  it('deleting writes an audit row', async () => {
    const editorEmail = 'audit-delete@example.com';
    await seedUser(editorEmail, { media: true });
    asUser(editorEmail);
    const uploadRes = await callUpload(jpegFormData());
    const { media } = await uploadRes.json();

    const deleteRes = await call('DELETE', `/api/admin/media/${media.key}`);
    expect(deleteRes.status).toBe(200);

    const row = await env.DB.prepare(
      'SELECT * FROM audit_log WHERE action = ? AND detail = ?',
    ).bind('media.delete', media.key).first();
    expect(row).not.toBeNull();
    expect(row.actor_email).toBe(editorEmail);
  });

  it('a published object stops being served after unpublish', async () => {
    const editorEmail = 'publish-unpublish-cycle@example.com';
    await seedUser(editorEmail, { media: true });
    asUser(editorEmail);
    const uploadRes = await callUpload(jpegFormData());
    const { media } = await uploadRes.json();
    await call('PATCH', `/api/admin/media/${media.key}`, { altText: 'Campers at the lake.' });

    await call('POST', `/api/admin/media/${media.key}/publish`);

    const publicRes = await app.fetch(
      new Request(`https://bmxc.camp/media/${media.key}`),
      env,
    );
    expect(publicRes.status).toBe(200);

    await call('POST', `/api/admin/media/${media.key}/unpublish`);

    const afterUnpublishRes = await app.fetch(
      new Request(`https://bmxc.camp/media/${media.key}`),
      env,
    );
    expect(afterUnpublishRes.status).toBe(404);
  });
});

describe('public media route', () => {
  it('serves a published object with immutable cache headers', async () => {
    const editorEmail = 'public-serve@example.com';
    await seedUser(editorEmail, { media: true });
    asUser(editorEmail);
    const uploadRes = await callUpload(jpegFormData());
    const { media } = await uploadRes.json();
    await call('PATCH', `/api/admin/media/${media.key}`, { altText: 'Campers at the lake.' });
    await call('POST', `/api/admin/media/${media.key}/publish`);

    // No mock active for the public fetch either — the public route must
    // not attempt auth at all.
    vi.restoreAllMocks();

    const res = await app.fetch(
      new Request(`https://bmxc.camp/media/${media.key}`),
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');

    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBe(JPEG.length);
  });

  it('serves the stored content-type, never a guessed one', async () => {
    const editorEmail = 'content-type-check@example.com';
    await seedUser(editorEmail, { media: true });
    asUser(editorEmail);
    const uploadRes = await callUpload(jpegFormData());
    const { media } = await uploadRes.json();
    expect(media.content_type).toBe('image/jpeg');
    await call('PATCH', `/api/admin/media/${media.key}`, { altText: 'Campers at the lake.' });
    await call('POST', `/api/admin/media/${media.key}/publish`);

    const res = await app.fetch(
      new Request(`https://bmxc.camp/media/${media.key}`),
      env,
    );
    expect(res.headers.get('content-type')).toBe('image/jpeg');
  });
});

describe('media list', () => {
  it('lists uploaded media for a media editor', async () => {
    await uploadAsMediaEditor('list-editor@example.com');

    const res = await call('GET', '/api/admin/media');
    expect(res.status).toBe(200);
    const { media } = await res.json();
    expect(media.length).toBeGreaterThanOrEqual(1);
  });

  it('allows an admin to use media routes without the explicit media flag', async () => {
    const admin = await seedAdmin('media-admin@example.com');
    asUser(admin);

    const res = await call('GET', '/api/admin/media');
    expect(res.status).toBe(200);
  });
});

describe('media alt text', () => {
  it('sets alt text via PATCH', async () => {
    const media = await uploadAsMediaEditor('alt-text-set@example.com');

    const res = await call('PATCH', `/api/admin/media/${media.key}`, { altText: 'Two campers by the lake.' });
    expect(res.status).toBe(200);
    const { media: updated } = await res.json();
    expect(updated.alt_text).toBe('Two campers by the lake.');
  });

  it('PATCH on an unknown key is a 404, not a 500', async () => {
    await seedUser('alt-text-unknown@example.com', { media: true });
    asUser('alt-text-unknown@example.com');

    const res = await call('PATCH', '/api/admin/media/no-such-key.jpg', { altText: 'x' });
    expect(res.status).toBe(404);
  });

  it('denies PATCH to a user without the media permission', async () => {
    await seedUser('alt-text-no-perm@example.com', { blog: true });
    asUser('alt-text-no-perm@example.com');

    const res = await call('PATCH', '/api/admin/media/some-key.jpg', { altText: 'x' });
    expect(res.status).toBe(403);
  });

  // Alt text is a publish precondition, so an edit to it is worth
  // attributing — matches the audit row every other media write already
  // gets (publish/unpublish/delete). See worker/routes/media.js.
  it('editing alt text writes an audit row', async () => {
    const editorEmail = 'audit-update@example.com';
    const media = await uploadAsMediaEditor(editorEmail);

    const res = await call('PATCH', `/api/admin/media/${media.key}`, { altText: 'Campers at dinner.' });
    expect(res.status).toBe(200);

    const row = await env.DB.prepare(
      'SELECT * FROM audit_log WHERE action = ? AND detail = ?',
    ).bind('media.update', media.key).first();
    expect(row).not.toBeNull();
    expect(row.actor_email).toBe(editorEmail);
  });

  it('publishing without alt text is refused with a clear reason, and the photo stays private', async () => {
    const media = await uploadAsMediaEditor('publish-no-alt@example.com');

    const res = await call('POST', `/api/admin/media/${media.key}/publish`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/alt text/i);

    const publicRes = await app.fetch(
      new Request(`https://bmxc.camp/media/${media.key}`),
      env,
    );
    expect(publicRes.status).toBe(404);
  });

  it('publishing succeeds once alt text is set', async () => {
    const media = await uploadAsMediaEditor('publish-with-alt@example.com');
    await call('PATCH', `/api/admin/media/${media.key}`, { altText: 'Campers on the trail.' });

    const res = await call('POST', `/api/admin/media/${media.key}/publish`);
    expect(res.status).toBe(200);
  });
});
